package com.vstms.backend;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.vstms.backend.model.BillDTO;
import com.vstms.backend.model.DcDTO;
import com.vstms.backend.model.TNoteDTO;
import com.vstms.backend.model.TransformerDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * GoogleSheetsService - Single Source of Truth for VSTMS
 * 
 * Communicates with Google Sheets via Google Apps Script Web App.
 * Handles Enquiries, Services, Jobs, Transformers, TNotes, DCs, and Bills.
 */
@Service
public class GoogleSheetsService {

    private static final Logger log = LoggerFactory.getLogger(GoogleSheetsService.class);

    private static final List<String> STATUS_ORDER = List.of(
            "Recieved",
            "Assesment",
            "Repair In Progress",
            "Repaired",
            "Delivered",
            "Billed"
    );

    @Value("${google.apps.script.url}")
    private String appsScriptUrl;

    private final ObjectMapper objectMapper = createObjectMapper();
    private final HttpClient httpClient;

    // Resilient local memory cache synced with Google Sheets
    private final Map<Long, TransformerDTO> transformerCache = new ConcurrentHashMap<>();
    private final Map<Long, TNoteDTO> tnoteCache = new ConcurrentHashMap<>();
    private final Map<String, DcDTO> dcCache = new ConcurrentHashMap<>();
    private final Map<String, BillDTO> billCache = new ConcurrentHashMap<>();
    private volatile boolean cacheInitialized = false;

    public GoogleSheetsService() {
        this.httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.ALWAYS)
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    private static ObjectMapper createObjectMapper() {
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
        SimpleModule dateCompatibility = new SimpleModule();
        dateCompatibility.addDeserializer(LocalDate.class, new JsonDeserializer<>() {
            private final Pattern spreadsheetDate = Pattern.compile("^([A-Za-z]{3} [A-Za-z]{3} \\d{1,2} \\d{4})");
            private final DateTimeFormatter spreadsheetDateFormat =
                    DateTimeFormatter.ofPattern("EEE MMM d uuuu", Locale.US);

            @Override
            public LocalDate deserialize(JsonParser parser, DeserializationContext context) throws IOException {
                String value = parser.getValueAsString();
                if (value == null || value.isBlank()) return null;

                try {
                    if (value.matches("^\\d{4}-\\d{2}-\\d{2}.*")) {
                        return LocalDate.parse(value.substring(0, 10));
                    }
                    Matcher match = spreadsheetDate.matcher(value);
                    if (match.find()) {
                        return LocalDate.parse(match.group(1), spreadsheetDateFormat);
                    }
                } catch (DateTimeParseException exception) {
                    throw JsonMappingException.from(parser, "Invalid date value: " + value, exception);
                }
                throw JsonMappingException.from(parser, "Unsupported date value: " + value);
            }
        });
        mapper.registerModule(dateCompatibility);
        return mapper;
    }

    // ============ CORE HTTP CLIENT ============

    public Map<String, Object> postToAppsScript(Map<String, Object> payload) {
        return postToAppsScript(payload, Duration.ofSeconds(25));
    }

    private Map<String, Object> postToAppsScript(Map<String, Object> payload, Duration requestTimeout) {
        try {
            String jsonPayload = objectMapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(appsScriptUrl))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .timeout(requestTimeout)
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            // Handle potential manual redirect if not automatically handled
            if (response.statusCode() == 302 || response.statusCode() == 301 || response.statusCode() == 307) {
                String redirectUrl = response.headers().firstValue("Location").orElse(null);
                if (redirectUrl != null) {
                    HttpRequest getReq = HttpRequest.newBuilder()
                            .uri(URI.create(redirectUrl))
                            .GET()
                            .timeout(requestTimeout)
                            .build();
                    response = httpClient.send(getReq, HttpResponse.BodyHandlers.ofString());
                }
            }

            String body = response.body();
            if (body != null && !body.isBlank()) {
                return objectMapper.readValue(body, new TypeReference<Map<String, Object>>() {});
            }
            return errorResponse("Empty response from Google Apps Script");
        } catch (Exception e) {
            log.warn("Communication with Google Apps Script failed: {}", e.getMessage());
            return errorResponse("Google Apps Script error: " + e.getMessage());
        }
    }

    private Map<String, Object> errorResponse(String message) {
        Map<String, Object> res = new HashMap<>();
        res.put("status", "ERROR");
        res.put("message", message);
        res.put("data", Collections.emptyList());
        return res;
    }

    // ============ ENQUIRIES ============

    public Map<String, Object> submitEnquiry(Map<String, Object> enquiryData) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "ADD_ENQUIRY");
        payload.put("payload", enquiryData);
        return postToAppsScript(payload);
    }

    public Map<String, Object> getAllEnquiries() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_ENQUIRIES");
        return postToAppsScript(payload);
    }

    public Map<String, Object> getEnquiryById(Long id) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_ENQUIRY_BY_ID");
        Map<String, Object> params = new HashMap<>();
        params.put("id", id);
        payload.put("payload", params);
        return postToAppsScript(payload);
    }

    public Map<String, Object> getEnquiriesByStatus(String status) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_ENQUIRIES_BY_STATUS");
        Map<String, Object> params = new HashMap<>();
        params.put("status", status);
        payload.put("payload", params);
        return postToAppsScript(payload);
    }

    public Map<String, Object> getEnquiriesByPhone(String phone) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_ENQUIRIES_BY_PHONE");
        Map<String, Object> params = new HashMap<>();
        params.put("phone", phone);
        payload.put("payload", params);
        return postToAppsScript(payload);
    }

    public Map<String, Object> updateEnquiryStatus(Long id, String status, String notes) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "UPDATE_ENQUIRY_STATUS");
        Map<String, Object> params = new HashMap<>();
        params.put("id", id);
        params.put("status", status);
        params.put("notes", notes != null ? notes : "");
        payload.put("payload", params);
        return postToAppsScript(payload);
    }

    // ============ SERVICES ============

    public Map<String, Object> initializeServices() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "INIT_SERVICES");
        return postToAppsScript(payload);
    }

    public Map<String, Object> getServices() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_SERVICES");
        return postToAppsScript(payload);
    }

    public Map<String, Object> getServiceById(Long id) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_SERVICE_BY_ID");
        Map<String, Object> params = new HashMap<>();
        params.put("id", id);
        payload.put("payload", params);
        return postToAppsScript(payload);
    }

    // ============ JOBS ============

    public Map<String, Object> addJob(Map<String, Object> jobData) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "ADD_JOB");
        payload.put("payload", jobData);
        return postToAppsScript(payload);
    }

    public Map<String, Object> getAllJobs() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_JOBS");
        return postToAppsScript(payload);
    }

    public Map<String, Object> getJobsByStatus(String status) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_JOBS_BY_STATUS");
        Map<String, Object> params = new HashMap<>();
        params.put("status", status);
        payload.put("payload", params);
        return postToAppsScript(payload);
    }

    // ============ TRANSFORMERS ============

    public List<TransformerDTO> fetchAllTransformersFromSheets() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_TRANSFORMERS");
        Map<String, Object> res = postToAppsScript(payload);

        if ("SUCCESS".equals(res.get("status")) && res.get("data") instanceof List<?> list) {
            List<TransformerDTO> dtos = new ArrayList<>();
            for (Object item : list) {
                TransformerDTO dto = objectMapper.convertValue(item, TransformerDTO.class);
                if (dto != null && dto.getId() != null) {
                    dtos.add(dto);
                    transformerCache.put(dto.getId(), dto);
                }
            }
            cacheInitialized = true;
            return dtos;
        }

        // Fallback to cache or seed defaults if cache is empty
        ensureCacheSeeded();
        return new ArrayList<>(transformerCache.values());
    }

    public TransformerController.PagedResponse<TransformerDTO> getTransformers(
            int page,
            int size,
            List<String> statuses,
            List<String> spmCenters,
            List<String> dtrNos,
            List<String> sNos,
            List<Long> tNoteIds,
            List<String> types,
            List<Integer> capacities) {

        List<TransformerDTO> all = fetchAllTransformersFromSheets();
        Map<Long, Set<Long>> linkedTNotesByTransformer = new HashMap<>();
        if (tNoteIds != null && !tNoteIds.isEmpty()) {
            getAllTNotes().forEach(tNote -> tNote.getTransformers().forEach(transformer ->
                    linkedTNotesByTransformer.computeIfAbsent(transformer.getId(), ignored -> new HashSet<>()).add(tNote.getId())));
        }

        // Apply filters
        List<TransformerDTO> filtered = all.stream().filter(t -> {
            if (statuses != null && !statuses.isEmpty() && !statuses.contains(t.getStatus())) return false;
            if (spmCenters != null && !spmCenters.isEmpty() && !spmCenters.contains(t.getSpmCenter())) return false;
            if (dtrNos != null && !dtrNos.isEmpty() && !dtrNos.contains(t.getDtrNo())) return false;
            if (sNos != null && !sNos.isEmpty() && !sNos.contains(t.getSNo())) return false;
            if (tNoteIds != null && !tNoteIds.isEmpty()
                    && !tNoteIds.stream().anyMatch(id -> linkedTNotesByTransformer
                            .getOrDefault(t.getId(), Collections.emptySet()).contains(id))) return false;
            if (types != null && !types.isEmpty() && !types.contains(t.getType())) return false;
            if (capacities != null && !capacities.isEmpty() && !capacities.contains(t.getCapacity())) return false;
            return true;
        }).sorted(Comparator
                .comparing(TransformerDTO::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(TransformerDTO::getId, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        int totalElements = filtered.size();
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), 50);
        int totalPages = (int) Math.ceil((double) totalElements / safeSize);

        int fromIndex = Math.min(safePage * safeSize, totalElements);
        int toIndex = Math.min(fromIndex + safeSize, totalElements);
        List<TransformerDTO> content = filtered.subList(fromIndex, toIndex);

        return new TransformerController.PagedResponse<>(content, safePage, safeSize, totalElements, totalPages);
    }

    public TransformerController.SummaryResponse getSummary() {
        List<TransformerDTO> all = fetchAllTransformersFromSheets();
        long recieve = 0, assesment = 0, repairInProgress = 0, repaired = 0, delivered = 0, billed = 0, scrap = 0;

        for (TransformerDTO t : all) {
            String s = t.getStatus() != null ? t.getStatus().trim().toLowerCase() : "";
            if (s.equals("recieved") || s.equals("receive")) recieve++;
            else if (s.equals("assesment") || s.equals("assessment")) assesment++;
            else if (s.equals("repair in progress") || s.equals("repair_in_progress")) repairInProgress++;
            else if (s.equals("repaired")) repaired++;
            else if (s.equals("delivered")) delivered++;
            else if (s.equals("billed")) billed++;
            else if (s.equals("scrap")) scrap++;
        }
        return new TransformerController.SummaryResponse(recieve, assesment, repairInProgress, repaired, delivered, billed, scrap);
    }

    public Optional<TransformerDTO> getTransformerById(Long id) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_TRANSFORMER_BY_ID");
        Map<String, Object> p = new HashMap<>();
        p.put("id", id);
        payload.put("payload", p);
        Map<String, Object> res = postToAppsScript(payload);

        if ("SUCCESS".equals(res.get("status")) && res.get("data") != null) {
            TransformerDTO dto = objectMapper.convertValue(res.get("data"), TransformerDTO.class);
            if (dto != null) {
                transformerCache.put(dto.getId(), dto);
                return Optional.of(dto);
            }
        }
        return Optional.ofNullable(transformerCache.get(id));
    }

    public TransformerDTO createTransformer(String spmCenter, String dtrNo, String sNo, int capacity, String type, double oilCapacity, Long tNoteId, String intakeType) {
        Long nextId = transformerCache.keySet().stream().max(Long::compareTo).orElse(0L) + 1;
        TransformerDTO dto = new TransformerDTO(nextId, spmCenter, dtrNo, sNo, capacity, type, oilCapacity, "Recieved", tNoteId, null, null);
        dto.setIntakeType(intakeType);
        if (tNoteId != null) {
            dto.setVisitStatus("Recieved");
            dto.setBillable(!"RGP".equalsIgnoreCase(intakeType));
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "ADD_TRANSFORMER");
        payload.put("payload", dto);
        Map<String, Object> res = postToAppsScript(payload);

        if ("SUCCESS".equals(res.get("status")) && res.get("data") != null) {
            TransformerDTO created = objectMapper.convertValue(res.get("data"), TransformerDTO.class);
            if (created != null && created.getId() != null) {
                if (tNoteId != null && !Objects.equals(tNoteId, created.getTNoteId())) {
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                            "Transformer was created without the requested TNote association. Verify the Apps Script deployment before retrying.");
                }
                if ("RGP".equalsIgnoreCase(intakeType)
                        && (!"RGP".equalsIgnoreCase(created.getIntakeType()) || !Boolean.FALSE.equals(created.getBillable()))) {
                    Map<String, Object> rollbackPayload = new HashMap<>();
                    rollbackPayload.put("action", "DELETE_TRANSFORMER");
                    rollbackPayload.put("payload", Map.of("id", created.getId()));
                    Map<String, Object> rollback = postToAppsScript(rollbackPayload);
                    transformerCache.remove(nextId);
                    if (!"SUCCESS".equals(rollback.get("status"))) {
                        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                                "The Apps Script deployment does not support RGP intake, and the created transformer could not be rolled back (ID "
                                        + created.getId() + ").");
                    }
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                            "RGP intake is not enabled in the deployed Apps Script. The incomplete transformer registration was removed; deploy the updated script and retry.");
                }
                transformerCache.put(created.getId(), created);
                return created;
            }
        }
        if ("RGP".equalsIgnoreCase(intakeType) || tNoteId != null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    String.valueOf(res.getOrDefault("message", "Failed to create transformer and link its TNote.")));
        }
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                String.valueOf(res.getOrDefault("message", "Failed to create transformer.")));
    }

    public List<TransformerDTO> findTransformersByIdentity(String field, String value) {
        if (!"dtrNo".equals(field) && !"sNo".equals(field)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Search using either a DTR number or serial number.");
        }
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a DTR number or serial number.");
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "FIND_TRANSFORMERS_BY_IDENTITY");
        Map<String, Object> params = new HashMap<>();
        params.put("field", "dtrNo".equals(field) ? "DtrNo" : "SNo");
        params.put("value", value.trim());
        payload.put("payload", params);
        Map<String, Object> res = postToAppsScript(payload);
        if (!"SUCCESS".equals(res.get("status")) || !(res.get("data") instanceof List<?> list)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    String.valueOf(res.getOrDefault("message", "Transformer lookup failed.")));
        }
        return list.stream()
                .map(item -> objectMapper.convertValue(item, TransformerDTO.class))
                .filter(Objects::nonNull)
                .toList();
    }

    public TransformerDTO linkExistingTransformerToTNote(Long tNoteId, Long transformerId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "LINK_TNOTE_TRANSFORMER");
        Map<String, Object> params = new HashMap<>();
        params.put("tNoteId", tNoteId);
        params.put("transformerId", transformerId);
        params.put("intakeType", "RGP");
        payload.put("payload", params);
        Map<String, Object> res = postToAppsScript(payload);
        if (!"SUCCESS".equals(res.get("status")) || res.get("data") == null) {
            HttpStatus status = "NOT_FOUND".equals(res.get("status")) ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
            throw new ResponseStatusException(status,
                    String.valueOf(res.getOrDefault("message", "Failed to link transformer to TNote.")));
        }
        TransformerDTO linked = objectMapper.convertValue(res.get("data"), TransformerDTO.class);
        refreshTNoteCache(tNoteId);
        return linked;
    }

    public TransformerDTO updateRgpVisitStatus(Long tNoteId, Long transformerId, String visitStatus) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "UPDATE_TNOTE_TRANSFORMER_VISIT_STATUS");
        Map<String, Object> params = new HashMap<>();
        params.put("tNoteId", tNoteId);
        params.put("transformerId", transformerId);
        params.put("visitStatus", visitStatus);
        payload.put("payload", params);
        Map<String, Object> res = postToAppsScript(payload);
        if (!"SUCCESS".equals(res.get("status")) || res.get("data") == null) {
            HttpStatus status = "NOT_FOUND".equals(res.get("status")) ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
            throw new ResponseStatusException(status,
                    String.valueOf(res.getOrDefault("message", "Failed to update RGP visit status.")));
        }
        TransformerDTO updated = objectMapper.convertValue(res.get("data"), TransformerDTO.class);
        refreshTNoteCache(tNoteId);
        return updated;
    }

    public void unlinkTransformerFromTNote(Long tNoteId, Long transformerId) {
        TransformerDTO transformer = getTransformerById(transformerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer not found."));
        if ("Delivered".equalsIgnoreCase(transformer.getStatus()) || "Billed".equalsIgnoreCase(transformer.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A delivered transformer cannot be removed from its TNote.");
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "UNLINK_TNOTE_TRANSFORMER");
        Map<String, Object> params = new HashMap<>();
        params.put("tNoteId", tNoteId);
        params.put("transformerId", transformerId);
        payload.put("payload", params);
        Map<String, Object> res = postToAppsScript(payload);
        if (!"SUCCESS".equals(res.get("status"))) {
            HttpStatus status = "NOT_FOUND".equals(res.get("status")) ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
            throw new ResponseStatusException(status,
                    String.valueOf(res.getOrDefault("message", "Failed to remove transformer from TNote.")));
        }
        refreshTNoteCache(tNoteId);
    }

    private void refreshTNoteCache(Long tNoteId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_TNOTE_BY_ID");
        payload.put("payload", Map.of("id", tNoteId));
        Map<String, Object> res = postToAppsScript(payload);
        if ("SUCCESS".equals(res.get("status")) && res.get("data") != null) {
            TNoteDTO tNote = objectMapper.convertValue(res.get("data"), TNoteDTO.class);
            if (tNote != null && tNote.getId() != null) tnoteCache.put(tNote.getId(), tNote);
        }
    }

    public TransformerDTO updateTransformer(Long id, String spmCenter, String dtrNo, String sNo, int capacity, String type, double oilCapacity) {
        TransformerDTO dto = getTransformerById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer not found"));

        dto.setSpmCenter(spmCenter);
        dto.setDtrNo(dtrNo);
        dto.setSNo(sNo);
        dto.setCapacity(capacity);
        dto.setType(type);
        dto.setOilCapacity(oilCapacity);
        transformerCache.put(id, dto);

        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "UPDATE_TRANSFORMER");
        Map<String, Object> params = new HashMap<>();
        params.put("id", id);
        params.put("spmCenter", spmCenter);
        params.put("dtrNo", dtrNo);
        params.put("sNo", sNo);
        params.put("capacity", capacity);
        params.put("type", type);
        params.put("oilCapacity", oilCapacity);
        payload.put("payload", params);
        postToAppsScript(payload);

        return dto;
    }

    public void deleteTransformer(Long id) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "DELETE_TRANSFORMER");
        Map<String, Object> params = new HashMap<>();
        params.put("id", id);
        payload.put("payload", params);
        Map<String, Object> res = postToAppsScript(payload);
        if (!"SUCCESS".equals(res.get("status"))) {
            HttpStatus status = "NOT_FOUND".equals(res.get("status")) ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
            throw new ResponseStatusException(status, String.valueOf(res.getOrDefault("message", "Failed to delete transformer.")));
        }
        transformerCache.remove(id);
    }

    public TransformerDTO updateTransformerStatus(Long id, String newStatus) {
        TransformerDTO dto = getTransformerById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer not found"));

        validateStatusTransition(dto.getStatus(), newStatus);

        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "UPDATE_TRANSFORMER_STATUS");
        Map<String, Object> params = new HashMap<>();
        params.put("id", id);
        params.put("status", newStatus);
        payload.put("payload", params);
        Map<String, Object> res = postToAppsScript(payload);
        if (!"SUCCESS".equals(res.get("status"))) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    String.valueOf(res.getOrDefault("message", "Failed to update transformer status.")));
        }
        if (res.get("data") != null) {
            dto = objectMapper.convertValue(res.get("data"), TransformerDTO.class);
        } else {
            dto.setStatus(newStatus);
        }
        transformerCache.put(id, dto);

        return dto;
    }

    public TransformerDTO deliverTransformer(Long id, String dcNo) {
        TransformerDTO dto = getTransformerById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer not found"));

        if (!"Repaired".equalsIgnoreCase(dto.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only repaired transformers can be delivered");
        }
        if (dcNo == null || dcNo.isBlank() || getDCById(dcNo).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Select an existing delivery challan before delivering a transformer.");
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "DELIVER_TRANSFORMER");
        Map<String, Object> params = new HashMap<>();
        params.put("id", id);
        params.put("dcNo", dcNo);
        payload.put("payload", params);
        Map<String, Object> res = postToAppsScript(payload);
        if (!"SUCCESS".equals(res.get("status"))) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    String.valueOf(res.getOrDefault("message", "Failed to deliver transformer.")));
        }
        if (res.get("data") != null) dto = objectMapper.convertValue(res.get("data"), TransformerDTO.class);
        else {
            dto.setDcNo(dcNo);
            dto.setStatus("Delivered");
        }
        transformerCache.put(id, dto);

        return dto;
    }

    public DcDTO addTransformerToDC(String dcNo, Long transformerId) {
        return updateDCTransformerAssignment(dcNo, transformerId, true);
    }

    public DcDTO removeTransformerFromDC(String dcNo, Long transformerId) {
        return updateDCTransformerAssignment(dcNo, transformerId, false);
    }

    public DcDTO markDCAsDelivered(String dcNo, List<Map<String, Object>> attachments) {
        DcDTO existing = getDCById(dcNo)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Delivery challan not found."));
        if (Boolean.TRUE.equals(existing.getDelivered())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This delivery challan has already been marked delivered.");
        }
        if (attachments == null || attachments.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Upload the signed delivery challan before marking it delivered.");
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "MARK_DC_DELIVERED");
        payload.put("payload", Map.of("dcNo", dcNo, "attachments", attachments));
        Map<String, Object> response = postToAppsScript(payload);
        if (!"SUCCESS".equals(response.get("status")) || response.get("data") == null) {
            String message = String.valueOf(response.getOrDefault("message", "Failed to mark delivery challan as delivered."));
            HttpStatus status = message.toLowerCase().contains("not found")
                    ? HttpStatus.NOT_FOUND
                    : message.toLowerCase().contains("already")
                        ? HttpStatus.CONFLICT
                        : HttpStatus.BAD_REQUEST;
            throw new ResponseStatusException(status, message);
        }
        DcDTO updated = objectMapper.convertValue(response.get("data"), DcDTO.class);
        dcCache.put(updated.getDcNo(), updated);
        return updated;
    }

    private DcDTO updateDCTransformerAssignment(String dcNo, Long transformerId, boolean assign) {
        DcDTO dc = getDCById(dcNo)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Delivery challan not found."));
        if (Boolean.TRUE.equals(dc.getDelivered())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A delivered challan cannot be edited.");
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", assign ? "ADD_TRANSFORMER_TO_DC" : "REMOVE_TRANSFORMER_FROM_DC");
        Map<String, Object> params = new HashMap<>();
        params.put("dcNo", dcNo);
        params.put("transformerId", transformerId);
        payload.put("payload", params);
        Map<String, Object> response = postToAppsScript(payload);
        if (!"SUCCESS".equals(response.get("status")) || response.get("data") == null) {
            String message = String.valueOf(response.getOrDefault("message", "Failed to update challan transformers."));
            HttpStatus status = message.toLowerCase().contains("not found")
                    ? HttpStatus.NOT_FOUND
                    : HttpStatus.BAD_REQUEST;
            throw new ResponseStatusException(status, message);
        }
        DcDTO updated = objectMapper.convertValue(response.get("data"), DcDTO.class);
        dcCache.put(updated.getDcNo(), updated);
        return updated;
    }

    public TransformerDTO billTransformer(Long id, String sapNo) {
        TransformerDTO dto = getTransformerById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer not found"));

        boolean hasRgpVisit = getAllTNotes().stream()
                .flatMap(tNote -> tNote.getTransformers().stream())
                .anyMatch(transformer -> Objects.equals(transformer.getId(), id)
                        && "RGP".equalsIgnoreCase(transformer.getIntakeType()));
        if (hasRgpVisit) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Transformers linked to an RGP visit cannot be billed through normal SAP billing.");
        }
        if ("Scrap".equalsIgnoreCase(dto.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Scrapped transformers cannot be billed.");
        }
        if (!"Delivered".equalsIgnoreCase(dto.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only delivered transformers can be billed");
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "BILL_TRANSFORMER");
        Map<String, Object> params = new HashMap<>();
        params.put("id", id);
        params.put("sapNo", sapNo);
        payload.put("payload", params);
        Map<String, Object> res = postToAppsScript(payload);
        if (!"SUCCESS".equals(res.get("status"))) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    String.valueOf(res.getOrDefault("message", "Failed to bill transformer.")));
        }
        if (res.get("data") != null) dto = objectMapper.convertValue(res.get("data"), TransformerDTO.class);
        else {
            dto.setSapNo(sapNo);
            dto.setStatus("Billed");
        }
        transformerCache.put(id, dto);

        if (sapNo != null && !billCache.containsKey(sapNo)) {
            saveBill(new BillDTO(sapNo, LocalDate.now(), dto.getSpmCenter(), 1, 0.0));
        }

        return dto;
    }

    public List<TransformerDTO> getTransformersByDcNo(String dcNo) {
        List<TransformerDTO> all = fetchAllTransformersFromSheets();
        return all.stream()
                .filter(t -> dcNo != null && dcNo.equalsIgnoreCase(t.getDcNo()))
                .sorted(Comparator
                        .comparing(TransformerDTO::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(TransformerDTO::getId, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    public List<TransformerDTO> getTransformersBySapNo(String sapNo) {
        List<TransformerDTO> all = fetchAllTransformersFromSheets();
        return all.stream()
                .filter(t -> sapNo != null && sapNo.equalsIgnoreCase(t.getSapNo()))
                .sorted(Comparator
                        .comparing(TransformerDTO::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(TransformerDTO::getId, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private void validateStatusTransition(String current, String next) {
        if ("Scrap".equalsIgnoreCase(next)) {
            if (List.of("Recieved", "Assesment", "Repair In Progress", "Repaired").stream()
                    .anyMatch(status -> status.equalsIgnoreCase(current))) {
                return;
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only transformers not yet delivered can be marked as Scrap.");
        }
        int currentIndex = STATUS_ORDER.indexOf(current);
        int nextIndex = STATUS_ORDER.indexOf(next);
        if (currentIndex == -1 || nextIndex == -1 || nextIndex != currentIndex + 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status transition from " + current + " to " + next);
        }
    }

    // ============ TNOTES ============

    public List<TNoteDTO> getAllTNotes() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_TNOTES");
        Map<String, Object> res = postToAppsScript(payload);

        if ("SUCCESS".equals(res.get("status")) && res.get("data") instanceof List<?> list) {
            List<TNoteDTO> dtos = new ArrayList<>();
            for (Object item : list) {
                TNoteDTO dto = objectMapper.convertValue(item, TNoteDTO.class);
                if (dto != null && dto.getId() != null) {
                    dtos.add(dto);
                    tnoteCache.put(dto.getId(), dto);
                }
            }
            return dtos;
        }

        ensureCacheSeeded();
        return new ArrayList<>(tnoteCache.values()).stream()
                .sorted(Comparator.comparing(TNoteDTO::getId))
                .toList();
    }

    public Optional<TNoteDTO> getTNoteById(Long id) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_TNOTE_BY_ID");
        Map<String, Object> p = new HashMap<>();
        p.put("id", id);
        payload.put("payload", p);
        Map<String, Object> res = postToAppsScript(payload);

        if ("SUCCESS".equals(res.get("status")) && res.get("data") != null) {
            TNoteDTO dto = objectMapper.convertValue(res.get("data"), TNoteDTO.class);
            if (dto != null) {
                tnoteCache.put(dto.getId(), dto);
                return Optional.of(dto);
            }
        }
        return Optional.ofNullable(tnoteCache.get(id));
    }

    public TNoteDTO saveTNote(TNoteDTO tNote) {
        Long nextId = tNote.getId() != null ? tNote.getId() :
                tnoteCache.keySet().stream().max(Long::compareTo).orElse(0L) + 1;
        tNote.setId(nextId);

        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "ADD_TNOTE");
        payload.put("payload", tNote);
        Map<String, Object> res = postToAppsScript(payload);

        if ("SUCCESS".equals(res.get("status")) && res.get("data") != null) {
            TNoteDTO created = objectMapper.convertValue(res.get("data"), TNoteDTO.class);
            if (created != null && created.getId() != null) {
                tnoteCache.put(created.getId(), created);
                return created;
            }
        }
        throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                String.valueOf(res.getOrDefault("message", "Failed to save TNote attachments and record.")));
    }

    public TNoteDTO updateTNote(TNoteDTO tNote) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "UPDATE_TNOTE");
        payload.put("payload", tNote);
        Map<String, Object> res = postToAppsScript(payload);
        if ("SUCCESS".equals(res.get("status")) && res.get("data") != null) {
            TNoteDTO updated = objectMapper.convertValue(res.get("data"), TNoteDTO.class);
            if (updated != null && updated.getId() != null) {
                tnoteCache.put(updated.getId(), updated);
                return updated;
            }
        }
        HttpStatus status = "NOT_FOUND".equals(res.get("status")) ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
        throw new ResponseStatusException(status,
                String.valueOf(res.getOrDefault("message", "Failed to update TNote.")));
    }

    public void deleteTNote(Long id) {
        TNoteDTO tNote = getTNoteById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "TNote not found."));
        boolean hasDeliveredTransformer = tNote.getTransformers().stream()
                .anyMatch(transformer -> "Delivered".equalsIgnoreCase(transformer.getStatus())
                        || "Billed".equalsIgnoreCase(transformer.getStatus()));
        if (hasDeliveredTransformer) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A TNote linked to a delivered transformer cannot be deleted.");
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "DELETE_TNOTE");
        Map<String, Object> p = new HashMap<>();
        p.put("id", id);
        payload.put("payload", p);
        Map<String, Object> res = postToAppsScript(payload);
        if (!"SUCCESS".equals(res.get("status"))) {
            HttpStatus status = "NOT_FOUND".equals(res.get("status")) ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
            throw new ResponseStatusException(status,
                    String.valueOf(res.getOrDefault("message", "Failed to delete TNote.")));
        }
        tnoteCache.remove(id);
    }

    // ============ DCS ============

    public List<DcDTO> getAllDCs() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_DCS");
        Map<String, Object> res = postToAppsScript(payload);

        if ("SUCCESS".equals(res.get("status")) && res.get("data") instanceof List<?> list) {
            List<DcDTO> dtos = new ArrayList<>();
            for (Object item : list) {
                DcDTO dto = objectMapper.convertValue(item, DcDTO.class);
                if (dto != null && dto.getDcNo() != null) {
                    dtos.add(dto);
                    dcCache.put(dto.getDcNo(), dto);
                }
            }
            return dtos;
        }

        ensureCacheSeeded();
        return new ArrayList<>(dcCache.values());
    }

    public Optional<DcDTO> getDCById(String dcNo) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_DC_BY_NO");
        Map<String, Object> p = new HashMap<>();
        p.put("dcNo", dcNo);
        payload.put("payload", p);
        Map<String, Object> res = postToAppsScript(payload);

        if ("SUCCESS".equals(res.get("status")) && res.get("data") != null) {
            DcDTO dto = objectMapper.convertValue(res.get("data"), DcDTO.class);
            if (dto != null) {
                dcCache.put(dto.getDcNo(), dto);
                return Optional.of(dto);
            }
        }
        return Optional.ofNullable(dcCache.get(dcNo));
    }

    public DcDTO saveDC(DcDTO dc) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "ADD_DC");
        payload.put("payload", dc);
        return persistDC(payload, null);
    }

    public DcDTO updateDC(DcDTO dc) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "UPDATE_DC");
        payload.put("payload", dc);
        return persistDC(payload, dc.getDcNo());
    }

    public DcDTO saveGeneratedChallanPdf(String dcNo, String fileName, String dataUrl) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "SAVE_GENERATED_DC_PDF");
        payload.put("payload", Map.of("dcNo", dcNo, "fileName", fileName, "dataUrl", dataUrl));
        Map<String, Object> response = postToAppsScript(payload);
        if (!"SUCCESS".equals(response.get("status")) || response.get("data") == null) {
            String message = String.valueOf(response.getOrDefault("message", "Failed to save generated delivery challan."));
            HttpStatus status = message.toLowerCase().contains("not found")
                    ? HttpStatus.NOT_FOUND
                    : HttpStatus.BAD_GATEWAY;
            throw new ResponseStatusException(status, message);
        }
        DcDTO saved = objectMapper.convertValue(response.get("data"), DcDTO.class);
        dcCache.put(saved.getDcNo(), saved);
        return saved;
    }

    private DcDTO persistDC(Map<String, Object> payload, String requestedDcNo) {
        Map<String, Object> res = postToAppsScript(payload);
        if (!"SUCCESS".equals(res.get("status")) || res.get("data") == null) {
            HttpStatus status = String.valueOf(res.getOrDefault("message", "")).toLowerCase().contains("already exists")
                    ? HttpStatus.CONFLICT
                    : HttpStatus.BAD_GATEWAY;
            throw new ResponseStatusException(status,
                    String.valueOf(res.getOrDefault("message", "Failed to save delivery challan.")));
        }
        DcDTO saved = objectMapper.convertValue(res.get("data"), DcDTO.class);
        if (saved.getDcNo() == null || saved.getDcNo().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "The delivery challan service returned no challan number.");
        }
        if (requestedDcNo != null && !requestedDcNo.isBlank() && !saved.getDcNo().equals(requestedDcNo)) {
            dcCache.remove(requestedDcNo);
        }
        dcCache.put(saved.getDcNo(), saved);
        return saved;
    }

    public void deleteDC(String dcNo) {
        dcCache.remove(dcNo);
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "DELETE_DC");
        Map<String, Object> p = new HashMap<>();
        p.put("dcNo", dcNo);
        payload.put("payload", p);
        postToAppsScript(payload);
    }

    // ============ BILLS ============

    public List<BillDTO> getAllBills() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_BILLS");
        Map<String, Object> res = postToAppsScript(payload);

        if ("SUCCESS".equals(res.get("status")) && res.get("data") instanceof List<?> list) {
            List<BillDTO> dtos = new ArrayList<>();
            for (Object item : list) {
                BillDTO dto = objectMapper.convertValue(item, BillDTO.class);
                if (dto != null && dto.getSapNo() != null) {
                    dtos.add(dto);
                    billCache.put(dto.getSapNo(), dto);
                }
            }
            return dtos;
        }

        ensureCacheSeeded();
        return new ArrayList<>(billCache.values());
    }

    public Optional<BillDTO> getBillById(String sapNo) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_BILL_BY_SAP");
        Map<String, Object> p = new HashMap<>();
        p.put("sapNo", sapNo);
        payload.put("payload", p);
        Map<String, Object> res = postToAppsScript(payload);

        if ("SUCCESS".equals(res.get("status")) && res.get("data") != null) {
            BillDTO dto = objectMapper.convertValue(res.get("data"), BillDTO.class);
            if (dto != null) {
                billCache.put(dto.getSapNo(), dto);
                return Optional.of(dto);
            }
        }
        return Optional.ofNullable(billCache.get(sapNo));
    }

    public BillDTO saveBill(BillDTO bill) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "ADD_BILL");
        payload.put("payload", bill);
        Map<String, Object> res = postToAppsScript(payload);
        if ("SUCCESS".equals(res.get("status")) && res.get("data") != null) {
            BillDTO saved = objectMapper.convertValue(res.get("data"), BillDTO.class);
            if (saved != null && saved.getSapNo() != null) {
                billCache.put(saved.getSapNo(), saved);
                return saved;
            }
        }
        throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                String.valueOf(res.getOrDefault("message", "Failed to save bill attachments and record.")));
    }

    public void deleteBill(String sapNo) {
        billCache.remove(sapNo);
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "DELETE_BILL");
        Map<String, Object> p = new HashMap<>();
        p.put("sapNo", sapNo);
        payload.put("payload", p);
        postToAppsScript(payload);
    }

    public Map<String, Object> getQuotationConfig() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_QUOTATION_CONFIG");
        return postToAppsScript(payload);
    }

    public Map<String, Object> getDropdownDefaults() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_DROPDOWN_DEFAULTS");
        return postToAppsScript(payload);
    }

    public Map<String, Object> getAllQuotations() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_QUOTATIONS");
        return postToAppsScript(payload);
    }

    public Map<String, Object> getQuotationByNo(String quotationNo) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GET_QUOTATION_BY_NO");
        Map<String, Object> params = new HashMap<>();
        params.put("quotationNo", quotationNo);
        payload.put("payload", params);
        return postToAppsScript(payload);
    }

    public Map<String, Object> saveQuotation(Map<String, Object> quotation) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "SAVE_QUOTATION");
        payload.put("payload", quotation);
        return postToAppsScript(payload);
    }

    public Map<String, Object> reserveQuotationNumbers(Map<String, Object> request) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "RESERVE_QUOTATION_NUMBERS");
        payload.put("payload", request);
        return postToAppsScript(payload);
    }

    public Map<String, Object> saveGeneratedQuotationGroup(Map<String, Object> request) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "SAVE_GENERATED_QUOTATION_GROUP");
        payload.put("payload", request);
        return postToAppsScript(payload, Duration.ofSeconds(90));
    }

    public Map<String, Object> deleteQuotation(String quotationNo) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "DELETE_QUOTATION");
        Map<String, Object> quotation = new HashMap<>();
        quotation.put("quotationNo", quotationNo);
        payload.put("payload", quotation);
        return postToAppsScript(payload);
    }

    // ============ DEFAULT SAMPLE DATA INITIALIZER ============

    private synchronized void ensureCacheSeeded() {
        if (cacheInitialized) return;

        // Seed 3 TNotes
        TNoteDTO t1 = new TNoteDTO(1L, LocalDate.now().minusDays(10), 10, new ArrayList<>());
        TNoteDTO t2 = new TNoteDTO(2L, LocalDate.now().minusDays(5), 20, new ArrayList<>());
        TNoteDTO t3 = new TNoteDTO(3L, LocalDate.now().minusDays(2), 20, new ArrayList<>());
        tnoteCache.put(1L, t1);
        tnoteCache.put(2L, t2);
        tnoteCache.put(3L, t3);

        List<String> spmCenters = List.of("Warangal", "Salem", "Rajahmundry", "Mysuru", "Karimnagar");
        List<String> types = List.of("Distribution", "Power", "Step-up", "Step-down");

        int count = 0;
        List<TNoteDTO> notes = List.of(t1, t2, t3);
        for (TNoteDTO tNote : notes) {
            for (int i = 1; i <= tNote.getNumberOfTransformers() && count < 50; i++, count++) {
                String spmCenter = spmCenters.get(count % spmCenters.size());
                String dtrNo = String.format("DTR-%04d", 2400 + count);
                String sNo = String.format("SN-%04d", 1000 + count);
                int capacity = 100 + (count % 5) * 50;
                String type = types.get(count % types.size());
                double oilCapacity = 50.0 + (count % 3) * 10;
                String status = STATUS_ORDER.get(count % STATUS_ORDER.size());
                String dcNo = (status.equals("Delivered") || status.equals("Billed")) ? String.format("DC-%04d", 1000 + (count % 5)) : null;
                String sapNo = status.equals("Billed") ? String.format("SAP-%04d", 1000 + (count % 5)) : null;

                TransformerDTO transformer = new TransformerDTO(
                        (long) (count + 1),
                        spmCenter,
                        dtrNo,
                        sNo,
                        capacity,
                        type,
                        oilCapacity,
                        status,
                        tNote.getId(),
                        dcNo,
                        sapNo
                );
                transformerCache.put(transformer.getId(), transformer);
                tNote.getTransformers().add(transformer);
            }
        }

        // Seed 5 sample Bills
        for (int i = 0; i < 5; i++) {
            String sapNo = "SAP-" + (1000 + i);
            billCache.put(sapNo, new BillDTO(
                    sapNo,
                    LocalDate.now().minusDays(i * 3L),
                    spmCenters.get(i % spmCenters.size()),
                    2 + i,
                    150000.0 + (i * 25000)
            ));
        }

        // Seed 5 sample DCs
        for (int i = 0; i < 5; i++) {
            String dcNo = "DC-" + (1000 + i);
            dcCache.put(dcNo, new DcDTO(
                    dcNo,
                    LocalDate.now().minusDays(i * 4L),
                    spmCenters.get(i % spmCenters.size()),
                    3 + i
            ));
        }

        cacheInitialized = true;
    }
}
