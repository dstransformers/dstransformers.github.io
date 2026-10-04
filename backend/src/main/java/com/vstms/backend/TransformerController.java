package com.vstms.backend;

import com.vstms.backend.model.TransformerDTO;
import com.vstms.backend.model.AssessmentDetailsDTO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/transformers")
@Validated
public class TransformerController {

    @Autowired
    private GoogleSheetsService googleSheetsService;

    @GetMapping
    public PagedResponse<TransformerDTO> getTransformers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) List<String> status,
            @RequestParam(required = false) List<String> spmCenter,
            @RequestParam(required = false) List<String> dtrNo,
            @RequestParam(required = false) List<String> sNo,
            @RequestParam(required = false) List<Long> tNoteId,
            @RequestParam(required = false) List<String> type,
            @RequestParam(required = false) List<Integer> capacity) {
        return googleSheetsService.getTransformers(page, size, status, spmCenter, dtrNo, sNo, tNoteId, type, capacity);
    }

    @GetMapping("/lookup")
    public List<TransformerDTO> findByIdentity(
            @RequestParam(required = false) String dtrNo,
            @RequestParam(required = false) String sNo) {
        if ((dtrNo == null || dtrNo.isBlank()) == (sNo == null || sNo.isBlank())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Provide exactly one of dtrNo or sNo.");
        }
        return googleSheetsService.findTransformersByIdentity(
                dtrNo != null && !dtrNo.isBlank() ? "dtrNo" : "sNo",
                dtrNo != null && !dtrNo.isBlank() ? dtrNo : sNo);
    }

    @GetMapping("/summary")
    public SummaryResponse getSummary() {
        return googleSheetsService.getSummary();
    }

    @PostMapping
    public TransformerDTO createTransformer(@Valid @RequestBody CreateTransformerRequest request) {
        return googleSheetsService.createTransformer(
                request.spmCenter(),
                request.dtrNo(),
                request.sNo(),
                request.capacity(),
                request.type(),
                request.oilCapacity(),
                request.tNoteId(),
                request.intakeType(),
                request.requestId()
        );
    }

    @PatchMapping("/{id}/status")
    public TransformerDTO updateStatus(@PathVariable Long id, @Valid @RequestBody UpdateStatusRequest request) {
        if ("Assesment".equalsIgnoreCase(request.status()) && request.assessmentDetails() == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Assessment details are required to move to Assessment.");
        }
        return googleSheetsService.updateTransformerStatus(id, request.status(), request.assessmentDetails());
    }

    @PatchMapping("/{id}/assessment")
    public TransformerDTO updateAssessment(
            @PathVariable Long id,
            @Valid @RequestBody AssessmentDetailsDTO assessmentDetails) {
        return googleSheetsService.updateTransformerAssessment(id, assessmentDetails);
    }

    @DeleteMapping("/{id}/assessment")
    public void deleteAssessment(@PathVariable Long id) {
        googleSheetsService.deleteTransformerAssessment(id);
    }

    @PatchMapping("/{id}/deliver")
    public TransformerDTO deliverTransformer(@PathVariable Long id, @RequestBody DeliverRequest request) {
        return googleSheetsService.deliverTransformer(id, request.dcNo());
    }

    @PatchMapping("/{id}/bill")
    public TransformerDTO billTransformer(@PathVariable Long id, @RequestBody BillRequest request) {
        return googleSheetsService.billTransformer(id, request.sapNo());
    }

    @PutMapping("/{id}")
    public TransformerDTO updateTransformer(@PathVariable Long id, @Valid @RequestBody UpdateTransformerRequest request) {
        return googleSheetsService.updateTransformer(
                id,
                request.spmCenter(),
                request.dtrNo(),
                request.sNo(),
                request.capacity(),
                request.type(),
                request.oilCapacity()
        );
    }

    @DeleteMapping("/{id}")
    public void deleteTransformer(@PathVariable Long id) {
        googleSheetsService.deleteTransformer(id);
    }

    @GetMapping("/{id}")
    public TransformerDTO getTransformer(@PathVariable Long id) {
        return googleSheetsService.getTransformerById(id).orElse(null);
    }

    @GetMapping("/dc/{dcNo}")
    public List<TransformerDTO> getTransformersByDcNo(@PathVariable String dcNo) {
        return googleSheetsService.getTransformersByDcNo(dcNo);
    }

    @GetMapping("/by-dc")
    public List<TransformerDTO> getTransformersByDcNumber(@RequestParam String dcNo) {
        return googleSheetsService.getTransformersByDcNo(dcNo);
    }

    @GetMapping("/bill/{sapNo}")
    public List<TransformerDTO> getTransformersBySapNo(@PathVariable String sapNo) {
        return googleSheetsService.getTransformersBySapNo(sapNo);
    }

    public record CreateTransformerRequest(
            @NotBlank String spmCenter,
            @NotBlank String dtrNo,
            @NotBlank String sNo,
            int capacity,
            @NotBlank String type,
            double oilCapacity,
            Long tNoteId,
            String intakeType,
            String requestId
    ) {}

    public record UpdateTransformerRequest(
            @NotBlank String spmCenter,
            @NotBlank String dtrNo,
            @NotBlank String sNo,
            int capacity,
            @NotBlank String type,
            double oilCapacity
    ) {}

    public record UpdateStatusRequest(
            @NotBlank String status,
            @jakarta.validation.Valid AssessmentDetailsDTO assessmentDetails) {}

    public record DeliverRequest(@NotBlank String dcNo) {}

    public record BillRequest(@NotBlank String sapNo) {}

    public record PagedResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {}

    public record SummaryResponse(long recieve, long assesment, long repairInProgress, long repaired, long delivered, long billed, long scrap) {}
}