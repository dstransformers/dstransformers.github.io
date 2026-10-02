package com.vstms.backend;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JobRepository extends JpaRepository<JobEntity, String> {
  long countByStatus(JobStatus status);

  Page<JobEntity> findByStatus(JobStatus status, Pageable pageable);

  @Query("SELECT j FROM JobEntity j WHERE " +
         "(:status IS NULL OR j.status = :status) AND " +
         "(:id IS NULL OR :id = '' OR LOWER(j.id) LIKE LOWER(CONCAT('%', :id, '%'))) AND " +
         "(:customer IS NULL OR :customer = '' OR LOWER(j.customer) LIKE LOWER(CONCAT('%', :customer, '%'))) AND " +
         "(:fault IS NULL OR :fault = '' OR LOWER(j.fault) LIKE LOWER(CONCAT('%', :fault, '%')))")
  Page<JobEntity> findByFilters(@Param("status") JobStatus status, @Param("id") String id, @Param("customer") String customer, @Param("fault") String fault, Pageable pageable);
}
