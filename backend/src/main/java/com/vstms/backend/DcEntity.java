package com.vstms.backend;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "dcs")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class DcEntity {
    @Id
    @Column(nullable = false, length = 50)
    private String dcNo;

    @Column(nullable = false)
    private LocalDate date;

    @Column(length = 100)
    private String spmCenter;

    @Column(nullable = false)
    private int totalTransformers;

    protected DcEntity() {}

    public DcEntity(String dcNo, LocalDate date) {
        this.dcNo = dcNo;
        this.date = date;
        this.spmCenter = null;
        this.totalTransformers = 0;
    }

    public DcEntity(String dcNo, LocalDate date, String spmCenter, int totalTransformers) {
        this.dcNo = dcNo;
        this.date = date;
        this.spmCenter = spmCenter;
        this.totalTransformers = totalTransformers;
    }

    // Getters and setters
    public String getDcNo() {
        return dcNo;
    }

    public void setDcNo(String dcNo) {
        this.dcNo = dcNo;
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
}