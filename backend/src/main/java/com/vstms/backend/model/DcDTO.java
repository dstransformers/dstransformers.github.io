package com.vstms.backend.model;

import java.time.LocalDate;

public class DcDTO {
    private String dcNo;
    private LocalDate date;
    private String spmCenter;
    private int totalTransformers;

    public DcDTO() {
    }

    public DcDTO(String dcNo, LocalDate date, String spmCenter, int totalTransformers) {
        this.dcNo = dcNo;
        this.date = date;
        this.spmCenter = spmCenter;
        this.totalTransformers = totalTransformers;
    }

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