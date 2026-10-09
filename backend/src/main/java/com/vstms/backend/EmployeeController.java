package com.vstms.backend;

import com.vstms.backend.model.AttendanceDTO;
import com.vstms.backend.model.EmployeeDTO;
import com.vstms.backend.model.HolidayDTO;
import com.vstms.backend.model.SalaryDTO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/employees")
public class EmployeeController {
    @Autowired
    private GoogleSheetsService googleSheetsService;

    @GetMapping
    public List<EmployeeDTO> getEmployees() { return googleSheetsService.getAllEmployees(); }

    @GetMapping("/{id}")
    public ResponseEntity<EmployeeDTO> getEmployee(@PathVariable Long id) {
        return googleSheetsService.getEmployeeById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createEmployee(@Valid @RequestBody EmployeeDTO employee) {
        try {
            return ResponseEntity.ok(googleSheetsService.saveEmployee(employee));
        } catch (ResponseStatusException exception) {
            return employeeSaveError(exception);
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateEmployee(@PathVariable Long id, @Valid @RequestBody EmployeeDTO employee) {
        employee.setId(id);
        try {
            return ResponseEntity.ok(googleSheetsService.saveEmployee(employee));
        } catch (ResponseStatusException exception) {
            return employeeSaveError(exception);
        }
    }

    private ResponseEntity<Map<String, String>> employeeSaveError(ResponseStatusException exception) {
        String reason = exception.getReason();
        return ResponseEntity.status(exception.getStatusCode())
                .body(Map.of("message", reason == null ? "Employee save failed." : reason));
    }

    @PostMapping("/{id}/photo")
    public EmployeeDTO updateEmployeePhoto(@PathVariable Long id, @RequestBody PhotoRequest request) {
        EmployeeDTO employee = googleSheetsService.getEmployeeById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found."));
        employee.setPhotoUrl(request.photoUrl());
        employee.setPhotoName(request.photoName());
        return googleSheetsService.saveEmployee(employee);
    }

    @GetMapping("/{id}/attendance")
    public List<AttendanceDTO> getAttendance(@PathVariable Long id, @RequestParam(required = false) String month) {
        return googleSheetsService.getAttendance(id, month);
    }

    @PostMapping("/attendance/clock")
    public AttendanceDTO clockAttendance(@Valid @RequestBody ClockRequest request) {
        return googleSheetsService.clockAttendance(
                request.employeeId(), request.date(), request.inTime(), request.outTime(), request.photoUrl(), request.replaceTimes());
    }

    @GetMapping("/holidays")
    public List<HolidayDTO> getHolidays(@RequestParam(required = false) String month) {
        return googleSheetsService.getAllHolidays(month);
    }

    @PostMapping("/holidays")
    public HolidayDTO addHoliday(@Valid @RequestBody HolidayRequest request) {
        return googleSheetsService.addHoliday(request.employeeId(), request.date());
    }

    @DeleteMapping("/holidays/{id}")
    public void deleteHoliday(@PathVariable Long id) {
        googleSheetsService.deleteHoliday(id);
    }

    @PostMapping("/attendance/leave")
    public AttendanceDTO markEmployeeLeave(@Valid @RequestBody LeaveRequest request) {
        return googleSheetsService.markEmployeeLeave(request.employeeId(), request.date());
    }

    @DeleteMapping("/attendance/leave")
    public AttendanceDTO clearEmployeeLeave(@RequestParam Long employeeId, @RequestParam LocalDate date) {
        return googleSheetsService.clearEmployeeLeave(employeeId, date);
    }

    @GetMapping("/attendance")
    public List<AttendanceDTO> getAllAttendance(@RequestParam(required = false) String month) {
        return googleSheetsService.getAllAttendance(month);
    }

    @GetMapping("/salaries")
    public List<SalaryDTO> getSalaries(@RequestParam(required = false) String month) {
        return googleSheetsService.getAllSalaries(month);
    }

    @PostMapping("/salaries/generate")
    public SalaryDTO generateSalary(@Valid @RequestBody GenerateSalaryRequest request) {
        return googleSheetsService.generateSalary(request.employeeId(), request.month());
    }

    @PatchMapping("/salaries/{id}/status")
    public SalaryDTO updateSalaryStatus(@PathVariable Long id, @RequestBody SalaryStatusRequest request) {
        return googleSheetsService.updateSalaryStatus(id, request.status(), request.receivedAt());
    }

    public record PhotoRequest(String photoUrl, String photoName) {}
    public record ClockRequest(
            @NotNull Long employeeId,
            @NotNull LocalDate date,
            String inTime,
            String outTime,
            String photoUrl,
            boolean replaceTimes) {}
    public record HolidayRequest(@NotNull Long employeeId, @NotNull LocalDate date) {}
    public record LeaveRequest(@NotNull Long employeeId, @NotNull LocalDate date) {}
    public record GenerateSalaryRequest(@NotNull Long employeeId, @NotNull LocalDate month) {}
    public record SalaryStatusRequest(@NotBlank String status, LocalDate receivedAt) {}
}
