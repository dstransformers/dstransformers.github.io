package com.vstms.backend.model;

import java.time.LocalDate;

public class BillDTO {
    private String sapNo;
    private LocalDate date;
    private String spmCenter;
    private int totalTransformers;
    private Double billAmount;

    public BillDTO() {
    }

    public BillDTO(String sapNo, LocalDate date, String spmCenter, int totalTransformers, Double billAmount) {
        this.sapNo = sapNo;
        this.date = date;
        this.spmCenter = spmCenter;
        this.totalTransformers = totalTransformers;
        this.billAmount = billAmount;
    }

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

    public int getTotalTransformers() {
        return totalTransformers;
    }

    public void setTotalTransformers(int totalTransformers) {
        this.totalTransformers = totalTransformers;
    }

    public Double getBillAmount() {
        return billAmount;
    }

    public void setBillAmount(Double billAmount) {
        this.billAmount = billAmount;
    }
}