package com.vstms.backend;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/jobs")
@Validated
public class JobsController {
  private final JobService jobService;

  public JobsController(JobService jobService) {
    this.jobService = jobService;
  }

  @GetMapping
  public PagedResponse<JobResponse> getJobs(
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size,
      @RequestParam(defaultValue = "ALL") String status,
      @RequestParam(defaultValue = "") String id,
      @RequestParam(defaultValue = "") String customer,
      @RequestParam(defaultValue = "") String fault) {
    int safePage = Math.max(0, page);
    int safeSize = Math.min(Math.max(size, 1), 50);
    Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by("id").ascending());
    Page<JobEntity> jobsPage = jobService.listJobs(status, id, customer, fault, pageable);
    List<JobResponse> content = jobsPage.getContent().stream().map(this::toResponse).toList();
    return new PagedResponse<>(
        content,
        jobsPage.getNumber(),
        jobsPage.getSize(),
        jobsPage.getTotalElements(),
        jobsPage.getTotalPages());
  }

  @GetMapping("/summary")
  public JobService.SummaryResponse getSummary() {
    return jobService.summary();
  }

  @PostMapping
  public JobResponse createJob(@Valid @RequestBody CreateJobRequest request) {
    return toResponse(jobService.createJob(request.id(), request.customer(), request.fault()));
  }

  @PatchMapping("/{jobId}/status")
  public JobResponse updateStatus(
      @PathVariable String jobId, @Valid @RequestBody UpdateStatusRequest request) {
    return toResponse(jobService.updateStatus(jobId, request.status()));
  }

  private JobResponse toResponse(JobEntity entity) {
    return new JobResponse(
        entity.getId(), entity.getCustomer(), entity.getFault(), entity.getStatus().getLabel());
  }

  public record JobResponse(String id, String customer, String fault, String status) {}

  public record CreateJobRequest(
      @NotBlank(message = "id is required") String id,
      @NotBlank(message = "customer is required") String customer,
      @NotBlank(message = "fault is required") String fault) {}

  public record UpdateStatusRequest(@NotBlank(message = "status is required") String status) {}

  public record PagedResponse<T>(
      List<T> content, int page, int size, long totalElements, int totalPages) {}
}
