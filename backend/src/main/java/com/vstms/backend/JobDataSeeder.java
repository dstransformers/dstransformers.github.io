package com.vstms.backend;

import java.util.List;
import java.util.ArrayList;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class JobDataSeeder implements CommandLineRunner {
  private final JobRepository jobRepository;

  public JobDataSeeder(JobRepository jobRepository) {
    this.jobRepository = jobRepository;
  }

  @Override
  public void run(String... args) {
    if (jobRepository.count() >= 50) {
      return;
    }
    List<JobEntity> sampleJobs = new ArrayList<>();
    List<String> customers =
        List.of(
            "TSPDCL - Warangal",
            "TANGEDCO - Salem",
            "APEPDCL - Rajahmundry",
            "BESCOM - Mysuru",
            "TSNPDCL - Karimnagar",
            "TNEB - Madurai",
            "MSEDCL - Pune",
            "UPPCL - Kanpur",
            "PSPCL - Ludhiana",
            "WBSEDCL - Kolkata");
    List<String> faults =
        List.of(
            "Coil burnout",
            "Oil leakage",
            "Bushing failure",
            "Tap changer issue",
            "Winding short",
            "HT fuse failure",
            "Core heating",
            "Terminal damage",
            "Load imbalance",
            "Insulation degradation");
    JobStatus[] statuses = JobStatus.values();

    for (int i = 1; i <= 50; i++) {
      String id = String.format("DTR-%04d", 2400 + i);
      if (jobRepository.existsById(id)) {
        continue;
      }
      String customer = customers.get((i - 1) % customers.size());
      String fault = faults.get((i - 1) % faults.size());
      JobStatus status = statuses[(i - 1) % statuses.length];
      sampleJobs.add(new JobEntity(id, customer, fault, status));
    }
    if (!sampleJobs.isEmpty()) {
      jobRepository.saveAll(sampleJobs);
    }
  }
}
