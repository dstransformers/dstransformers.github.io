package com.vstms.backend;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "bills")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class BillEntity {
    @Id
    @Column(nullable = false, length = 50)
    private String sapNo;

    @Column(nullable = false)
    private LocalDate date;

    @Column(length = 100)
    private String spmCenter;

    @Column
    private Integer totalTransformers;

    @Column
    private Double billAmount;

    protected BillEntity() {}

    public BillEntity(String sapNo, LocalDate date, String spmCenter, Integer totalTransformers, Double billAmount) {
        this.sapNo = sapNo;
        this.date = date;
        this.spmCenter = spmCenter;
        this.totalTransformers = totalTransformers;
        this.billAmount = billAmount;
    }

    // Getters and setters
    public String getSapNo() {
        return sapNo;
    }

    public void setSapNo(String sapNo) {
        this.sapNo = sapNo;
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

    public Integer getTotalTransformers() {
        return totalTransformers;
    }

    public void setTotalTransformers(Integer totalTransformers) {
        this.totalTransformers = totalTransformers;
    }

    public Double getBillAmount() {
        return billAmount;
    }

    public void setBillAmount(Double billAmount) {
        this.billAmount = billAmount;
    }
}