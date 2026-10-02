package com.vstms.backend;

import java.util.Arrays;

public enum JobStatus {
  RECIEVE("Recieved"),
  ASSESMENT("Assesment"),
  REPAIR_IN_PROGRESS("Repair In Progress"),
  REPAIRED("Repaired"),
  DELIVERED("Delivered"),
  BILLED("Billed");

  private final String label;

  JobStatus(String label) {
    this.label = label;
  }

  public String getLabel() {
    return label;
  }

  public static JobStatus fromLabel(String value) {
    return Arrays.stream(values())
        .filter(status -> status.label.equalsIgnoreCase(value))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Invalid status: " + value));
  }
}
