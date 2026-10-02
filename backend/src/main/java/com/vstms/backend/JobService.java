package com.vstms.backend;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class JobService {
  private static final List<JobStatus> STATUS_ORDER =
      List.of(
          JobStatus.RECIEVE,
          JobStatus.ASSESMENT,
          JobStatus.REPAIR_IN_PROGRESS,
          JobStatus.REPAIRED,
          JobStatus.DELIVERED,
          JobStatus.BILLED);

  private final JobRepository jobRepository;

  public JobService(JobRepository jobRepository) {
    this.jobRepository = jobRepository;
  }

  @Transactional(readOnly = true)
  public Page<JobEntity> listJobs(String status, String id, String customer, String fault, Pageable pageable) {
    String normalizedId = id == null ? "" : id.trim();
    String normalizedCustomer = customer == null ? "" : customer.trim();
    String normalizedFault = fault == null ? "" : fault.trim();
    boolean hasId = !normalizedId.isBlank();
    boolean hasCustomer = !normalizedCustomer.isBlank();
    boolean hasFault = !normalizedFault.isBlank();
    boolean hasStatus = status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status);

    if (!hasStatus && !hasId && !hasCustomer && !hasFault) {
      return jobRepository.findAll(pageable);
    }

    JobStatus parsedStatus = hasStatus ? parseStatus(status) : null;
    return jobRepository.findByFilters(parsedStatus, normalizedId, normalizedCustomer, normalizedFault, pageable);
  }

  @Transactional
  public JobEntity createJob(String id, String customer, String fault) {
    String normalizedId = trimToNull(id);
    String normalizedCustomer = trimToNull(customer);
    String normalizedFault = trimToNull(fault);

    if (normalizedId == null || normalizedCustomer == null || normalizedFault == null) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "id, customer, and fault are required");
    }
    if (jobRepository.existsById(normalizedId)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Job ID already exists");
    }

    return jobRepository.save(
        new JobEntity(normalizedId, normalizedCustomer, normalizedFault, JobStatus.RECIEVE));
  }

  @Transactional
  public JobEntity updateStatus(String jobId, String nextStatusLabel) {
    JobEntity existing =
        jobRepository
            .findById(jobId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found"));
    JobStatus nextStatus = parseStatus(nextStatusLabel);
    JobStatus currentStatus = existing.getStatus();

    int currentIndex = STATUS_ORDER.indexOf(currentStatus);
    int requestedIndex = STATUS_ORDER.indexOf(nextStatus);
    if (requestedIndex < 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status");
    }
    if (requestedIndex > currentIndex + 1) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Cannot skip stages while updating status");
    }
    if (nextStatus == JobStatus.BILLED && currentStatus != JobStatus.DELIVERED) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Billing is allowed only after delivery");
    }

    existing.setStatus(nextStatus);
    return jobRepository.save(existing);
  }

  @Transactional(readOnly = true)
  public SummaryResponse summary() {
    return new SummaryResponse(
        jobRepository.countByStatus(JobStatus.RECIEVE),
        jobRepository.countByStatus(JobStatus.ASSESMENT),
        jobRepository.countByStatus(JobStatus.REPAIR_IN_PROGRESS),
        jobRepository.countByStatus(JobStatus.REPAIRED),
        jobRepository.countByStatus(JobStatus.DELIVERED),
        jobRepository.countByStatus(JobStatus.BILLED));
  }

  private JobStatus parseStatus(String value) {
    try {
      return JobStatus.fromLabel(value);
    } catch (IllegalArgumentException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status");
    }
  }

  private String trimToNull(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  public record SummaryResponse(
      long recieve,
      long assesment,
      long repairInProgress,
      long repaired,
      long delivered,
      long billed) {}
}
