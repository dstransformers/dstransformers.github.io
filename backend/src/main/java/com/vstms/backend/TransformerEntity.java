package com.vstms.backend;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.util.List;

@Entity
@Table(name = "transformers")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class TransformerEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String spmCenter;

    @Column(nullable = false, length = 50)
    private String dtrNo;

    @Column(nullable = false, length = 50)
    private String sNo;

    @Column(nullable = false)
    private int capacity;

    @Column(nullable = false, length = 50)
    private String type;

    @Column(nullable = false)
    private double oilCapacity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private JobStatus status;

    @JsonBackReference
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "t_note_id")
    private TNoteEntity tNote;

    @Column(length = 50)
    private String dcNo;

    @Column(length = 50)
    private String sapNo;

    protected TransformerEntity() {}

    public TransformerEntity(String spmCenter, String dtrNo, String sNo, int capacity, String type, double oilCapacity, JobStatus status, TNoteEntity tNote) {
        this.spmCenter = spmCenter;
        this.dtrNo = dtrNo;
        this.sNo = sNo;
        this.capacity = capacity;
        this.type = type;
        this.oilCapacity = oilCapacity;
        this.status = status;
        this.tNote = tNote;
    }

    // Getters and setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSpmCenter() {
        return spmCenter;
    }

    public void setSpmCenter(String spmCenter) {
        this.spmCenter = spmCenter;
    }

    public String getDtrNo() {
        return dtrNo;
    }

    public void setDtrNo(String dtrNo) {
        this.dtrNo = dtrNo;
    }

    public String getSNo() {
        return sNo;
    }

    public void setSNo(String sNo) {
        this.sNo = sNo;
    }

    public int getCapacity() {
        return capacity;
    }

    public void setCapacity(int capacity) {
        this.capacity = capacity;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public double getOilCapacity() {
        return oilCapacity;
    }

    public void setOilCapacity(double oilCapacity) {
        this.oilCapacity = oilCapacity;
    }

    public JobStatus getStatus() {
        return status;
    }

    public void setStatus(JobStatus status) {
        this.status = status;
    }

    public TNoteEntity getTNote() {
        return tNote;
    }

    public void setTNote(TNoteEntity tNote) {
        this.tNote = tNote;
    }

    public String getDcNo() {
        return dcNo;
    }

    public void setDcNo(String dcNo) {
        this.dcNo = dcNo;
    }

    public String getSapNo() {
        return sapNo;
    }

    public void setSapNo(String sapNo) {
        this.sapNo = sapNo;
    }
}