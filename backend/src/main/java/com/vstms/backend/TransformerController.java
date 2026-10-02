package com.vstms.backend;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/transformers")
@Validated
@CrossOrigin(origins = "*")
public class TransformerController {

    @Autowired
    private TransformerService transformerService;

    @Autowired
    private TransformerRepository transformerRepository;

    @GetMapping
    public PagedResponse<TransformerResponse> getTransformers(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(required = false) List<String> status,
        @RequestParam(required = false) List<String> spmCenter,
        @RequestParam(required = false) List<String> dtrNo,
        @RequestParam(required = false) List<String> sNo,
        @RequestParam(required = false) List<Long> tNoteId,
        @RequestParam(required = false) List<String> type,
        @RequestParam(required = false) List<Integer> capacity) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), 50);
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by("id").ascending());
        Page<TransformerEntity> transformersPage = transformerService.listTransformers(
            normalizeList(status),
            normalizeList(spmCenter),
            normalizeList(dtrNo),
            normalizeList(sNo),
            normalizeList(tNoteId),
            normalizeList(type),
            normalizeList(capacity),
            pageable);
        List<TransformerResponse> content = transformersPage.getContent().stream().map(this::toResponse).toList();
        return new PagedResponse<>(
            content,
            transformersPage.getNumber(),
            transformersPage.getSize(),
            transformersPage.getTotalElements(),
            transformersPage.getTotalPages());
    }

    private <T> List<T> normalizeList(List<T> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        List<T> normalized = values.stream()
            .filter(value -> value != null && !(value instanceof String str && str.isBlank()))
            .toList();
        return normalized.isEmpty() ? null : normalized;
    }

    @GetMapping("/summary")
    public SummaryResponse getSummary() {
        long recieve = transformerRepository.countByStatus(JobStatus.RECIEVE);
        long assesment = transformerRepository.countByStatus(JobStatus.ASSESMENT);
        long repairInProgress = transformerRepository.countByStatus(JobStatus.REPAIR_IN_PROGRESS);
        long repaired = transformerRepository.countByStatus(JobStatus.REPAIRED);
        long delivered = transformerRepository.countByStatus(JobStatus.DELIVERED);
        long billed = transformerRepository.countByStatus(JobStatus.BILLED);
        return new SummaryResponse(recieve, assesment, repairInProgress, repaired, delivered, billed);
    }

    @PostMapping
    public TransformerResponse createTransformer(@Valid @RequestBody CreateTransformerRequest request) {
        return toResponse(transformerService.createTransformer(request.spmCenter(), request.dtrNo(), request.sNo(), request.capacity(), request.type(), request.oilCapacity(), request.tNoteId()));
    }

    @PatchMapping("/{id}/status")
    public TransformerResponse updateStatus(@PathVariable Long id, @Valid @RequestBody UpdateStatusRequest request) {
        return toResponse(transformerService.updateTransformerStatus(id, JobStatus.valueOf(request.status().toUpperCase().replace(" ", "_"))));
    }

    @PatchMapping("/{id}/deliver")
    public TransformerResponse deliverTransformer(@PathVariable Long id, @RequestBody DeliverRequest request) {
        return toResponse(transformerService.deliverTransformer(id, request.dcNo()));
    }

    @PatchMapping("/{id}/bill")
    public TransformerResponse billTransformer(@PathVariable Long id, @RequestBody BillRequest request) {
        return toResponse(transformerService.billTransformer(id, request.sapNo()));
    }

    @PutMapping("/{id}")
    public TransformerResponse updateTransformer(@PathVariable Long id, @Valid @RequestBody UpdateTransformerRequest request) {
        return toResponse(transformerService.updateTransformer(id, request.spmCenter(), request.dtrNo(), request.sNo(), request.capacity(), request.type(), request.oilCapacity()));
    }

    @GetMapping("/{id}")
    public TransformerResponse getTransformer(@PathVariable Long id) {
        return transformerService.getTransformerById(id).map(this::toResponse).orElse(null);
    }

    @GetMapping("/dc/{dcNo}")
    public java.util.List<TransformerResponse> getTransformersByDcNo(@PathVariable String dcNo) {
        return transformerService.getTransformersByDcNo(dcNo).stream().map(this::toResponse).toList();
    }

    @GetMapping("/bill/{sapNo}")
    public java.util.List<TransformerResponse> getTransformersBySapNo(@PathVariable String sapNo) {
        return transformerService.getTransformersBySapNo(sapNo).stream().map(this::toResponse).toList();
    }

    private TransformerResponse toResponse(TransformerEntity entity) {
        return new TransformerResponse(
            entity.getId(),
            entity.getSpmCenter(),
            entity.getDtrNo(),
            entity.getSNo(),
            entity.getCapacity(),
            entity.getType(),
            entity.getOilCapacity(),
            entity.getStatus().getLabel(),
            entity.getTNote() != null ? entity.getTNote().getId() : null,
            entity.getDcNo(),
            entity.getSapNo()
        );
    }

    public record TransformerResponse(Long id, String spmCenter, String dtrNo, String sNo, int capacity, String type, double oilCapacity, String status, Long tNoteId, String dcNo, String sapNo) {}

    public record CreateTransformerRequest(
        @NotBlank String spmCenter,
        @NotBlank String dtrNo,
        @NotBlank String sNo,
        int capacity,
        @NotBlank String type,
        double oilCapacity,
        Long tNoteId
    ) {}

    public record UpdateTransformerRequest(
        @NotBlank String spmCenter,
        @NotBlank String dtrNo,
        @NotBlank String sNo,
        int capacity,
        @NotBlank String type,
        double oilCapacity
    ) {}

    public record UpdateStatusRequest(@NotBlank String status) {}

    public record DeliverRequest(@NotBlank String dcNo) {}

    public record BillRequest(@NotBlank String sapNo) {}

    public record PagedResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {}

    public record SummaryResponse(long recieve, long assesment, long repairInProgress, long repaired, long delivered, long billed) {}
}