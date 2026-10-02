package com.vstms.backend;

import java.time.LocalDate;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataSeeder implements CommandLineRunner {

    @Autowired
    private TNoteRepository tNoteRepository;

    @Autowired
    private TransformerRepository transformerRepository;

    @Autowired
    private BillRepository billRepository;

    @Override
    public void run(String... args) {
        if (transformerRepository.count() >= 50) {
            return;
        }

        // Create sample TNotes
        TNoteEntity tNote1 = new TNoteEntity(LocalDate.now().minusDays(10), 10);
        TNoteEntity tNote2 = new TNoteEntity(LocalDate.now().minusDays(5), 20);
        TNoteEntity tNote3 = new TNoteEntity(LocalDate.now().minusDays(2), 20);
        tNoteRepository.saveAll(List.of(tNote1, tNote2, tNote3));

        // Sample data
        List<String> spmCenters = List.of("Warangal", "Salem", "Rajahmundry", "Mysuru", "Karimnagar");
        List<String> types = List.of("Distribution", "Power", "Step-up", "Step-down");
        JobStatus[] statuses = JobStatus.values();

        int count = 0;
        for (TNoteEntity tNote : List.of(tNote1, tNote2, tNote3)) {
            for (int i = 1; i <= tNote.getNumberOfTransformers() && count < 50; i++, count++) {
                String spmCenter = spmCenters.get((count) % spmCenters.size());
                String dtrNo = String.format("DTR-%04d", 2400 + count);
                String sNo = String.format("SN-%04d", 1000 + count);
                int capacity = 100 + (count % 5) * 50; // 100, 150, 200, 250, 300
                String type = types.get(count % types.size());
                double oilCapacity = 50.0 + (count % 3) * 10; // 50, 60, 70
                JobStatus status = statuses[count % statuses.length];

                TransformerEntity transformer = new TransformerEntity(spmCenter, dtrNo, sNo, capacity, type, oilCapacity, status, tNote);
                transformerRepository.save(transformer);
            }
        }

        // Create sample Bills
        if (billRepository.count() == 0) {
            List<String> billSpmCenters = List.of("Warangal", "Salem", "Rajahmundry", "Mysuru", "Karimnagar");
            for (int i = 0; i < 5; i++) {
                BillEntity bill = new BillEntity(
                    "SAP-" + (1000 + i),
                    LocalDate.now().minusDays(i * 3),
                    billSpmCenters.get(i),
                    10 + (i * 5),
                    50000.0 + (i * 15000)
                );
                billRepository.save(bill);
            }
        }
    }
}