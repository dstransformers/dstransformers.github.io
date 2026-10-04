package com.vstms.backend.model;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class TNoteDTO {
    private Long id;
    private String tNoteNo;
    private LocalDate date;
    private int numberOfTransformers;
    private List<TransformerDTO> transformers = new ArrayList<>();
    private List<AttachmentDTO> attachments = new ArrayList<>();

    public TNoteDTO() {
    }

    public TNoteDTO(Long id, LocalDate date, int numberOfTransformers, List<TransformerDTO> transformers) {
        this.id = id;
        this.date = date;
        this.numberOfTransformers = numberOfTransformers;
        this.transformers = transformers != null ? transformers : new ArrayList<>();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTNoteNo() {
        return tNoteNo;
    }

    public void setTNoteNo(String tNoteNo) {
        this.tNoteNo = tNoteNo;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public int getNumberOfTransformers() {
        return numberOfTransformers;
    }

    public void setNumberOfTransformers(int numberOfTransformers) {
        this.numberOfTransformers = numberOfTransformers;
    }

    public List<TransformerDTO> getTransformers() {
        return transformers;
    }

    public void setTransformers(List<TransformerDTO> transformers) {
        this.transformers = transformers != null ? transformers : new ArrayList<>();
    }

    public List<AttachmentDTO> getAttachments() {
        return attachments;
    }

    public void setAttachments(List<AttachmentDTO> attachments) {
        this.attachments = attachments != null ? attachments : new ArrayList<>();
    }
}