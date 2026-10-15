package com.vstms.backend.model;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class BillDTO {
    private String sapNo;
    private String agreementNo;
    private LocalDate date;
    private String spmCenter;
    private int totalTransformers;
    private Double billAmount;
    private Double gstAmount = 0.0;
    private String status = "PENDING";
    private Double amountCredited;
    private LocalDate creditedDate;
    private String gstFilingMonth;
    private String invoiceNo;
    private List<AttachmentDTO> attachments = new ArrayList<>();

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

    public String getAgreementNo() {
        return agreementNo;
    }

    public void setAgreementNo(String agreementNo) {
        this.agreementNo = agreementNo;
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

    public Double getGstAmount() {
        return gstAmount;
    }

    public void setGstAmount(Double gstAmount) {
        this.gstAmount = gstAmount;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Double getAmountCredited() {
        return amountCredited;
    }

    public void setAmountCredited(Double amountCredited) {
        this.amountCredited = amountCredited;
    }

    public LocalDate getCreditedDate() {
        return creditedDate;
    }

    public void setCreditedDate(LocalDate creditedDate) {
        this.creditedDate = creditedDate;
    }

    public String getGstFilingMonth() {
        return gstFilingMonth;
    }

    public void setGstFilingMonth(String gstFilingMonth) {
        this.gstFilingMonth = gstFilingMonth;
    }

    public String getInvoiceNo() {
        return invoiceNo;
    }

    public void setInvoiceNo(String invoiceNo) {
        this.invoiceNo = invoiceNo;
    }

    public List<AttachmentDTO> getAttachments() {
        return attachments;
    }

    public void setAttachments(List<AttachmentDTO> attachments) {
        this.attachments = attachments != null ? attachments : new ArrayList<>();
    }
}