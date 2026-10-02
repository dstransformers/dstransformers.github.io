package com.vstms.backend;

import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TransformerService {
    private static final List<JobStatus> STATUS_ORDER =
        List.of(
            JobStatus.RECIEVE,
            JobStatus.ASSESMENT,
            JobStatus.REPAIR_IN_PROGRESS,
            JobStatus.REPAIRED,
            JobStatus.DELIVERED,
            JobStatus.BILLED);

    @Autowired
    private TransformerRepository transformerRepository;

    @Autowired
    private TNoteRepository tNoteRepository;

    @Autowired
    private DcRepository dcRepository;

    @Autowired
    private BillRepository billRepository;

    @Transactional(readOnly = true)
    public Page<TransformerEntity> listTransformers(List<String> statuses, List<String> spmCenters, List<String> dtrNos, List<String> sNos, List<Long> tNoteIds, List<String> types, List<Integer> capacities, Pageable pageable) {
        List<JobStatus> normalizedStatuses = normalizeStatuses(statuses);
        List<String> normalizedSpmCenters = normalizeStringList(spmCenters);
        List<String> normalizedDtrNos = normalizeStringList(dtrNos);
        List<String> normalizedSNos = normalizeStringList(sNos);
        List<Long> normalizedTNoteIds = normalizeLongList(tNoteIds);
        List<String> normalizedTypes = normalizeStringList(types);
        List<Integer> normalizedCapacities = normalizeIntegerList(capacities);

        return transformerRepository.findByFilters(normalizedStatuses, normalizedSpmCenters, normalizedDtrNos, normalizedSNos, normalizedTNoteIds, normalizedTypes, normalizedCapacities, pageable);
    }

    private List<JobStatus> normalizeStatuses(List<String> statuses) {
        if (statuses == null || statuses.isEmpty()) {
            return null;
        }
        List<JobStatus> normalized = statuses.stream()
            .filter(status -> status != null && !status.isBlank())
            .map(String::trim)
            .map(this::parseStatus)
            .toList();
        return normalized.isEmpty() ? null : normalized;
    }

    private List<String> normalizeStringList(List<String> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        List<String> normalized = values.stream()
            .filter(value -> value != null && !value.isBlank())
            .map(String::trim)
            .toList();
        return normalized.isEmpty() ? null : normalized;
    }

    private List<Long> normalizeLongList(List<Long> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        List<Long> normalized = values.stream()
            .filter(java.util.Objects::nonNull)
            .toList();
        return normalized.isEmpty() ? null : normalized;
    }

    private List<Integer> normalizeIntegerList(List<Integer> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        List<Integer> normalized = values.stream()
            .filter(java.util.Objects::nonNull)
            .toList();
        return normalized.isEmpty() ? null : normalized;
    }

    @Transactional
    public TransformerEntity createTransformer(String spmCenter, String dtrNo, String sNo, int capacity, String type, double oilCapacity, Long tNoteId) {
        TNoteEntity tNote = tNoteRepository.findById(tNoteId).orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "TNote not found"));
        TransformerEntity transformer = new TransformerEntity(spmCenter, dtrNo, sNo, capacity, type, oilCapacity, JobStatus.RECIEVE, tNote);
        return transformerRepository.save(transformer);
    }

    @Transactional
    public TransformerEntity updateTransformerStatus(Long id, JobStatus newStatus) {
        TransformerEntity transformer = transformerRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer not found"));
        validateStatusTransition(transformer.getStatus(), newStatus);
        transformer.setStatus(newStatus);
        return transformerRepository.save(transformer);
    }

    @Transactional
    public TransformerEntity deliverTransformer(Long id, String dcNo) {
        TransformerEntity transformer = transformerRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer not found"));
        if (transformer.getStatus() != JobStatus.REPAIRED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only repaired transformers can be delivered");
        }
        transformer.setDcNo(dcNo);
        transformer.setStatus(JobStatus.DELIVERED);
        // Optionally create or update DcEntity
        DcEntity dc = dcRepository.findById(dcNo).orElse(new DcEntity(dcNo, java.time.LocalDate.now(), null, 0));
        dcRepository.save(dc);
        return transformerRepository.save(transformer);
    }

    @Transactional
    public TransformerEntity billTransformer(Long id, String sapNo) {
        TransformerEntity transformer = transformerRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer not found"));
        if (transformer.getStatus() != JobStatus.DELIVERED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only delivered transformers can be billed");
        }
        transformer.setSapNo(sapNo);
        transformer.setStatus(JobStatus.BILLED);
        // Optionally create or update BillEntity
        BillEntity bill = billRepository.findById(sapNo).orElse(new BillEntity(sapNo, java.time.LocalDate.now(), null, 0, null));
        billRepository.save(bill);
        return transformerRepository.save(transformer);
    }

    @Transactional
    public TransformerEntity updateTransformer(Long id, String spmCenter, String dtrNo, String sNo, int capacity, String type, double oilCapacity) {
        TransformerEntity transformer = transformerRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer not found"));
        transformer.setSpmCenter(spmCenter);
        transformer.setDtrNo(dtrNo);
        transformer.setSNo(sNo);
        transformer.setCapacity(capacity);
        transformer.setType(type);
        transformer.setOilCapacity(oilCapacity);
        return transformerRepository.save(transformer);
    }

    public Optional<TransformerEntity> getTransformerById(Long id) {
        return transformerRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public java.util.List<TransformerEntity> getTransformersByDcNo(String dcNo) {
        return transformerRepository.findByDcNo(dcNo);
    }

    @Transactional(readOnly = true)
    public java.util.List<TransformerEntity> getTransformersBySapNo(String sapNo) {
        return transformerRepository.findBySapNo(sapNo);
    }

    private void validateStatusTransition(JobStatus current, JobStatus next) {
        int currentIndex = STATUS_ORDER.indexOf(current);
        int nextIndex = STATUS_ORDER.indexOf(next);
        if (currentIndex == -1 || nextIndex == -1 || nextIndex != currentIndex + 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status transition");
        }
    }

    private JobStatus parseStatus(String status) {
        try {
            return JobStatus.valueOf(status.toUpperCase().replace(" ", "_"));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status: " + status);
        }
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}