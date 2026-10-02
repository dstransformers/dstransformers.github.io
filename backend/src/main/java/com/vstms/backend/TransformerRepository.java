package com.vstms.backend;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TransformerRepository extends JpaRepository<TransformerEntity, Long> {
    long countByStatus(JobStatus status);

    Page<TransformerEntity> findByStatus(JobStatus status, Pageable pageable);

    Page<TransformerEntity> findBySpmCenterContainingIgnoreCaseOrDtrNoContainingIgnoreCaseOrSNoContainingIgnoreCaseOrTypeContainingIgnoreCase(
        String spmCenter, String dtrNo, String sNo, String type, Pageable pageable);

    @Query("SELECT t FROM TransformerEntity t WHERE " +
           "(:status IS NULL OR t.status IN :status) AND " +
           "(:spmCenter IS NULL OR t.spmCenter IN :spmCenter) AND " +
           "(:dtrNo IS NULL OR t.dtrNo IN :dtrNo) AND " +
           "(:sNo IS NULL OR t.sNo IN :sNo) AND " +
           "(:tNoteId IS NULL OR t.tNote.id IN :tNoteId) AND " +
           "(:type IS NULL OR t.type IN :type) AND " +
           "(:capacity IS NULL OR t.capacity IN :capacity)")
    Page<TransformerEntity> findByFilters(@Param("status") List<JobStatus> status,
                                          @Param("spmCenter") List<String> spmCenter,
                                          @Param("dtrNo") List<String> dtrNo,
                                          @Param("sNo") List<String> sNo,
                                          @Param("tNoteId") List<Long> tNoteId,
                                          @Param("type") List<String> type,
                                          @Param("capacity") List<Integer> capacity,
                                          Pageable pageable);

    Page<TransformerEntity> findByCapacity(int capacity, Pageable pageable);

    Page<TransformerEntity> findByStatusAndCapacity(JobStatus status, int capacity, Pageable pageable);

    java.util.List<TransformerEntity> findByDcNo(String dcNo);

    java.util.List<TransformerEntity> findBySapNo(String sapNo);
}