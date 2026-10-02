package com.vstms.backend;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.List;

@Entity
@Table(name = "tnotes")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class TNoteEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private int numberOfTransformers;

    @JsonManagedReference
    @OneToMany(mappedBy = "tNote", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    private List<TransformerEntity> transformers;

    protected TNoteEntity() {}

    public TNoteEntity(LocalDate date, int numberOfTransformers) {
        this.date = date;
        this.numberOfTransformers = numberOfTransformers;
    }

    // Getters and setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public List<TransformerEntity> getTransformers() {
        return transformers;
    }

    public void setTransformers(List<TransformerEntity> transformers) {
        this.transformers = transformers;
    }
}