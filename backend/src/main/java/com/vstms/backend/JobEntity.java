package com.vstms.backend;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "jobs")
public class JobEntity {
  @Id
  @Column(nullable = false, updatable = false, length = 40)
  private String id;

  @Column(nullable = false, length = 120)
  private String customer;

  @Column(nullable = false, length = 200)
  private String fault;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 40)
  private JobStatus status;

  protected JobEntity() {}

  public JobEntity(String id, String customer, String fault, JobStatus status) {
    this.id = id;
    this.customer = customer;
    this.fault = fault;
    this.status = status;
  }

  public String getId() {
    return id;
  }

  public String getCustomer() {
    return customer;
  }

  public String getFault() {
    return fault;
  }

  public JobStatus getStatus() {
    return status;
  }

  public void setStatus(JobStatus status) {
    this.status = status;
  }
}
