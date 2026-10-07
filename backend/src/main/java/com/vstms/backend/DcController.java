package com.vstms.backend;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.vstms.backend.model.DcDTO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/dcs")
public class DcController {

    @Autowired
    private GoogleSheetsService googleSheetsService;

    @GetMapping
    public List<DcDTO> getAllDCs() {
        return googleSheetsService.getAllDCs();
    }

    @GetMapping("/{dcNo}")
    public ResponseEntity<DcDTO> getDCById(@PathVariable String dcNo) {
        return googleSheetsService.getDCById(dcNo)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/lookup")
    public ResponseEntity<DcDTO> getDCByNumber(@RequestParam String dcNo) {
        return googleSheetsService.getDCById(dcNo)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/lookup")
    public ResponseEntity<DcDTO> updateDCByNumber(@RequestParam String dcNo, @RequestBody DcRequest request) {
        return updateExistingDC(dcNo, request);
    }

    @DeleteMapping("/lookup")
    public ResponseEntity<Void> deleteDCByNumber(@RequestParam String dcNo) {
        return deleteExistingDC(dcNo);
    }

    @PostMapping("/transformers")
    public DcDTO addTransformer(@Valid @RequestBody DcTransformerRequest request) {
        String dcNo = request.dcNo();
        if (request.transformerId() == null || request.transformerId() < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select a valid transformer.");
        }
        return googleSheetsService.addTransformerToDC(dcNo, request.transformerId());
    }

    @PostMapping("/transformers/batch")
    public DcDTO addTransformers(@Valid @RequestBody DcTransformersRequest request) {
        return googleSheetsService.addTransformersToDC(request.dcNo(), request.transformerIds());
    }

    @DeleteMapping("/transformers")
    public DcDTO removeTransformer(@RequestParam String dcNo, @RequestParam Long transformerId) {
        return googleSheetsService.removeTransformerFromDC(dcNo, transformerId);
    }

    @PostMapping("/mark-delivered")
    public DcDTO markDelivered(@Valid @RequestBody MarkDeliveredRequest request) {
        if (request.attachments() == null || request.attachments().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Upload the signed delivery challan before marking it delivered.");
        }
        return googleSheetsService.markDCAsDelivered(request.dcNo(), request.attachments());
    }

    @PostMapping("/generated-pdf")
    public DcDTO saveGeneratedPdf(
            @Valid @RequestBody GeneratedPdfRequest request) {
        return googleSheetsService.saveGeneratedChallanPdf(
                request.dcNo(), request.fileName(), request.dataUrl());
    }

    @PostMapping
    public DcDTO createDC(@Valid @RequestBody DcRequest request) {
        DcDTO dc = new DcDTO(request.getDcNo(), request.getDate(), request.getSpmCenter(), request.getTotalTransformers());
        dc.setCustomerName(request.getCustomerName());
        dc.setCustomerAddress(request.getCustomerAddress());
        dc.setCustomerGstin(request.getCustomerGstin());
        dc.setCompanyGstin(request.getCompanyGstin());
        dc.setTNoteNo(request.getTNoteNo());
        dc.setEmptyDrumsAvailable(request.getEmptyDrumsAvailable());
        dc.setEmptyDrumCount(Boolean.TRUE.equals(request.getEmptyDrumsAvailable()) ? request.getEmptyDrumCount() : 0);
        dc.setSentToTgspdcl(request.getSentToTgspdcl());
        dc.setTransformerDetails(request.getTransformerDetails());
        if (request.getEmptyDrumsAvailable() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Specify whether empty oil drums are being returned.");
        }
        if (Boolean.TRUE.equals(request.getEmptyDrumsAvailable())
                && (request.getEmptyDrumCount() == null || request.getEmptyDrumCount() < 1)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter the number of empty oil drums being returned.");
        }
        if (request.getTransformerDetails() == null
                || request.getTransformerDetails().size() != request.getTotalTransformers()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Include saved details for every transformer selected for this challan.");
        }
        if (request.getTransformerIds() == null || request.getTransformerIds().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Select at least one transformer for this challan.");
        }
        if (request.getTransformerIds().stream().distinct().count() != request.getTransformerIds().size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Select distinct transformers for this challan.");
        }
        if (Boolean.TRUE.equals(request.getSentToTgspdcl())) {
            Set<String> centers = new HashSet<>();
            for (Map<String, Object> detail : request.getTransformerDetails()) {
                Object center = detail.get("spmCenter");
                centers.add(center == null ? "" : center.toString().trim());
            }
            if (centers.size() != 1 || centers.contains("")
                    || !centers.iterator().next().equals(request.getSpmCenter())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "A TGSPDCL challan must contain transformers from exactly one matching SPM Center.");
            }
            String expectedCustomerName = "AE/SPM/" + request.getSpmCenter() + "/TGSPDCL";
            if (!expectedCustomerName.equals(request.getCustomerName())
                    || !"TGSPDCL".equalsIgnoreCase(request.getCustomerAddress().trim())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "TGSPDCL challan customer name and address must use the generated TGSPDCL details.");
            }
        }
        return googleSheetsService.saveDC(dc, request.getTransformerIds(), request.getRequestId());
    }

    @PutMapping("/{dcNo}")
    public ResponseEntity<DcDTO> updateDC(@PathVariable String dcNo, @RequestBody DcRequest request) {
        return updateExistingDC(dcNo, request);
    }

    private ResponseEntity<DcDTO> updateExistingDC(String dcNo, DcRequest request) {
        return googleSheetsService.getDCById(dcNo)
                .map(dc -> {
                    if (Boolean.TRUE.equals(dc.getDelivered())) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                "A delivered challan cannot be edited.");
                    }
                    dc.setDate(request.getDate());
                    if (request.getSpmCenter() != null) dc.setSpmCenter(request.getSpmCenter());
                    if (request.getTotalTransformers() > 0) dc.setTotalTransformers(request.getTotalTransformers());
                    if (request.getCustomerName() != null) dc.setCustomerName(request.getCustomerName());
                    if (request.getCustomerAddress() != null) dc.setCustomerAddress(request.getCustomerAddress());
                    if (request.getCustomerGstin() != null) dc.setCustomerGstin(request.getCustomerGstin());
                    if (request.getCompanyGstin() != null) dc.setCompanyGstin(request.getCompanyGstin());
                    if (request.getTNoteNo() != null) dc.setTNoteNo(request.getTNoteNo());
                    if (request.getEmptyDrumsAvailable() != null) {
                        dc.setEmptyDrumsAvailable(request.getEmptyDrumsAvailable());
                        dc.setEmptyDrumCount(Boolean.TRUE.equals(request.getEmptyDrumsAvailable())
                                ? request.getEmptyDrumCount()
                                : 0);
                    }
                    if (request.getSentToTgspdcl() != null) dc.setSentToTgspdcl(request.getSentToTgspdcl());
                    if (request.getTransformerDetails() != null) dc.setTransformerDetails(request.getTransformerDetails());
                    return ResponseEntity.ok(googleSheetsService.updateDC(dc));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{dcNo}")
    public ResponseEntity<Void> deleteDC(@PathVariable String dcNo) {
        return deleteExistingDC(dcNo);
    }

    private ResponseEntity<Void> deleteExistingDC(String dcNo) {
        DcDTO dc = googleSheetsService.getDCById(dcNo)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Delivery challan not found."));
        if (Boolean.TRUE.equals(dc.getDelivered())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A delivered challan cannot be deleted.");
        }
        googleSheetsService.deleteDC(dcNo);
        return ResponseEntity.noContent().build();
    }

    public static class DcRequest {
        private String dcNo;
        @NotBlank
        private String requestId;
        @NotNull
        private LocalDate date;
        private String spmCenter;
        @Min(1)
        private int totalTransformers;
        @NotBlank
        private String customerName;
        @NotBlank
        private String customerAddress;
        @NotBlank
        @Pattern(regexp = "[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]")
        private String customerGstin;
        @NotBlank
        @Pattern(regexp = "[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]")
        private String companyGstin;
        private String tNoteNo;
        private Boolean emptyDrumsAvailable;
        private Integer emptyDrumCount;
        @NotNull
        private Boolean sentToTgspdcl;
        private List<Map<String, Object>> transformerDetails;
        private List<Long> transformerIds;

        public String getDcNo() {
            return dcNo;
        }

        public void setDcNo(String dcNo) {
            this.dcNo = dcNo;
        }

        public String getRequestId() {
            return requestId;
        }

        public void setRequestId(String requestId) {
            this.requestId = requestId;
        }

        public LocalDate getDate() {
            return date;
        }

        public void setDate(LocalDate date) {
            this.date = date;
        }

        public String getSpmCenter() {
            return spmCenter;
        }

        public void setSpmCenter(String spmCenter) {
            this.spmCenter = spmCenter;
        }

        public int getTotalTransformers() {
            return totalTransformers;
        }

        public void setTotalTransformers(int totalTransformers) {
            this.totalTransformers = totalTransformers;
        }

        public String getCustomerName() {
            return customerName;
        }

        public void setCustomerName(String customerName) {
            this.customerName = customerName;
        }

        public String getCustomerAddress() {
            return customerAddress;
        }

        public void setCustomerAddress(String customerAddress) {
            this.customerAddress = customerAddress;
        }

        public String getCustomerGstin() {
            return customerGstin;
        }

        public void setCustomerGstin(String customerGstin) {
            this.customerGstin = customerGstin;
        }

        public String getCompanyGstin() {
            return companyGstin;
        }

        public void setCompanyGstin(String companyGstin) {
            this.companyGstin = companyGstin;
        }

        @JsonProperty("tNoteNo")
        public String getTNoteNo() {
            return tNoteNo;
        }

        @JsonProperty("tNoteNo")
        public void setTNoteNo(String tNoteNo) {
            this.tNoteNo = tNoteNo;
        }

        public Boolean getEmptyDrumsAvailable() {
            return emptyDrumsAvailable;
        }

        public void setEmptyDrumsAvailable(Boolean emptyDrumsAvailable) {
            this.emptyDrumsAvailable = emptyDrumsAvailable;
        }

        public Integer getEmptyDrumCount() {
            return emptyDrumCount;
        }

        public void setEmptyDrumCount(Integer emptyDrumCount) {
            this.emptyDrumCount = emptyDrumCount;
        }

        public Boolean getSentToTgspdcl() {
            return sentToTgspdcl;
        }

        public void setSentToTgspdcl(Boolean sentToTgspdcl) {
            this.sentToTgspdcl = sentToTgspdcl;
        }

        public List<Map<String, Object>> getTransformerDetails() {
            return transformerDetails;
        }

        public void setTransformerDetails(List<Map<String, Object>> transformerDetails) {
            this.transformerDetails = transformerDetails;
        }

        public List<Long> getTransformerIds() {
            return transformerIds;
        }

        public void setTransformerIds(List<Long> transformerIds) {
            this.transformerIds = transformerIds;
        }

    }

    public record DcTransformerRequest(@NotBlank String dcNo, @NotNull Long transformerId) {}

        public record DcTransformersRequest(
            @NotBlank String dcNo,
            @NotEmpty List<@NotNull @Positive Long> transformerIds) {}

    public record MarkDeliveredRequest(
            @NotBlank String dcNo,
            @NotNull List<Map<String, Object>> attachments
    ) {}

    public record GeneratedPdfRequest(
            @NotBlank String dcNo,
            @NotBlank String fileName,
            @NotBlank String dataUrl
    ) {}
}