package com.vstms.backend;

import com.vstms.backend.model.TNoteDTO;
import com.vstms.backend.model.TransformerDTO;
import com.vstms.backend.model.BillDTO;
import com.vstms.backend.model.DcDTO;
import com.vstms.backend.security.FirebaseTokenVerifier;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class BackendApplicationTests {
	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private TestRestTemplate restTemplate;

	@LocalServerPort
	private int port;

	@MockitoBean
	private FirebaseTokenVerifier tokenVerifier;

	@MockitoBean
	private GoogleSheetsService googleSheetsService;

	@Test
	void contextLoads() {
	}

	@Test
	void localDatesAreSerializedAsIsoStringsForAppsScript() throws Exception {
		assertEquals("\"2026-10-04\"",
				GoogleSheetsService.createObjectMapper().writeValueAsString(LocalDate.of(2026, 10, 4)));
	}

	@Test
	void healthEndpointIsPublic() throws Exception {
		mockMvc.perform(get("/api/health"))
				.andExpect(status().isOk());
	}

	@Test
	void managementEndpointsRequireAdminAuthentication() throws Exception {
		mockMvc.perform(get("/api/quotations/config"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void authenticatedTNoteValidationErrorIsNotReplacedByUnauthorized() {
		when(tokenVerifier.verifyAdminToken("unit-test-token"))
				.thenReturn(Optional.of("admin@example.com"));

		HttpHeaders headers = new HttpHeaders();
		headers.setBearerAuth("unit-test-token");
		headers.setContentType(MediaType.APPLICATION_JSON);
		HttpEntity<String> request = new HttpEntity<>("{}", headers);

		var response = restTemplate.exchange(
				"http://localhost:" + port + "/api/tnotes",
				HttpMethod.POST,
				request,
				String.class);

		assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
	}

	@Test
	void validTNoteRequestBodyPassesControllerBinding() throws Exception {
		when(tokenVerifier.verifyAdminToken("unit-test-token"))
				.thenReturn(Optional.of("admin@example.com"));
		when(googleSheetsService.saveTNote(any(TNoteDTO.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		var result = mockMvc.perform(post("/api/tnotes")
						.header("Authorization", "Bearer unit-test-token")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"tNoteNo\":\"QA-BINDING-TEST\",\"date\":\"2026-10-04\",\"numberOfTransformers\":1,\"attachments\":[]}"))
				.andReturn();

		assertEquals(HttpStatus.OK.value(), result.getResponse().getStatus(),
				String.valueOf(result.getResolvedException()));
		assertTrue(result.getResponse().getContentAsString().contains("\"tNoteNo\":\"QA-BINDING-TEST\""));
		assertFalse(result.getResponse().getContentAsString().contains("\"TNoteNo\""));
	}

	@Test
	void validBillRequestPassesControllerBindingAndTrimsIdentifiers() throws Exception {
		when(tokenVerifier.verifyAdminToken("unit-test-token"))
				.thenReturn(Optional.of("admin@example.com"));
		when(googleSheetsService.saveBill(any(BillDTO.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		var result = mockMvc.perform(post("/api/bills")
						.header("Authorization", "Bearer unit-test-token")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"sapNo\":\" SAP-QA-1 \",\"agreementNo\":\" AGR-1 \",\"date\":\"2026-10-05\",\"spmCenter\":\" Warangal \",\"totalTransformers\":2,\"billAmount\":1000,\"gstAmount\":180,\"attachments\":[]}"))
				.andReturn();

		assertEquals(HttpStatus.OK.value(), result.getResponse().getStatus(),
				String.valueOf(result.getResolvedException()));
		assertTrue(result.getResponse().getContentAsString().contains("\"sapNo\":\"SAP-QA-1\""));
		assertTrue(result.getResponse().getContentAsString().contains("\"agreementNo\":\"AGR-1\""));
		assertTrue(result.getResponse().getContentAsString().contains("\"spmCenter\":\"Warangal\""));
	}

	@Test
	void generatedPdfRequestSupportsSlashDelimitedChallanNumbers() throws Exception {
		when(tokenVerifier.verifyAdminToken("unit-test-token"))
				.thenReturn(Optional.of("admin@example.com"));
		when(googleSheetsService.saveGeneratedChallanPdf(
				eq("DS/26-27/501"), eq("DS-26-27-501.pdf"), eq("data:application/pdf;base64,QA")))
				.thenReturn(new DcDTO("DS/26-27/501", LocalDate.of(2026, 10, 5), "Warangal", 1));

		mockMvc.perform(post("/api/dcs/generated-pdf")
						.header("Authorization", "Bearer unit-test-token")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"dcNo\":\"DS/26-27/501\",\"fileName\":\"DS-26-27-501.pdf\",\"dataUrl\":\"data:application/pdf;base64,QA\"}"))
				.andExpect(status().isOk());

		verify(googleSheetsService).saveGeneratedChallanPdf(
				"DS/26-27/501", "DS-26-27-501.pdf", "data:application/pdf;base64,QA");
	}

	@Test
	void billWithMissingRequiredAmountsIsRejectedBeforePersistence() throws Exception {
		when(tokenVerifier.verifyAdminToken("unit-test-token"))
				.thenReturn(Optional.of("admin@example.com"));

		mockMvc.perform(post("/api/bills")
						.header("Authorization", "Bearer unit-test-token")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"sapNo\":\"SAP-QA-INVALID\",\"agreementNo\":\"AGR-1\",\"date\":\"2026-10-05\",\"spmCenter\":\"Warangal\",\"totalTransformers\":1,\"attachments\":[]}"))
				.andExpect(status().isBadRequest());

		verify(googleSheetsService, org.mockito.Mockito.never()).saveBill(any(BillDTO.class));
	}

	@Test
	void transformerCanMoveBackOneActiveStageButNotFromDeliveredOrBilled() {
		GoogleSheetsService.validateStatusTransition("Assesment", "Recieved", 1, true);
		GoogleSheetsService.validateStatusTransition("Repair In Progress", "Assesment", 1, true);
		GoogleSheetsService.validateStatusTransition("Assesment", "Repair In Progress", 2, true);
		GoogleSheetsService.validateStatusTransition("Repaired", "Assesment", 2, true);

		assertThrows(ResponseStatusException.class,
				() -> GoogleSheetsService.validateStatusTransition("Delivered", "Repaired", 2, true));
		assertThrows(ResponseStatusException.class,
				() -> GoogleSheetsService.validateStatusTransition("Billed", "Delivered", 2, true));
		assertThrows(ResponseStatusException.class,
				() -> GoogleSheetsService.validateStatusTransition("Repaired", "Delivered", 2, false));
		assertThrows(ResponseStatusException.class,
				() -> GoogleSheetsService.validateStatusTransition("Repair In Progress", "Recieved", 1, true));
	}

	@Test
	void tNoteUpdateCanRepairARecordWithoutReadingItsBrokenDateFirst() throws Exception {
		when(tokenVerifier.verifyAdminToken("unit-test-token"))
				.thenReturn(Optional.of("admin@example.com"));
		when(googleSheetsService.updateTNote(any(TNoteDTO.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		var result = mockMvc.perform(put("/api/tnotes/4")
						.header("Authorization", "Bearer unit-test-token")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"tNoteNo\":\"QA-AUTH-FIX-20261004\",\"date\":\"2026-10-04\",\"numberOfTransformers\":1,\"attachments\":[]}"))
				.andReturn();

		assertEquals(HttpStatus.OK.value(), result.getResponse().getStatus(),
				String.valueOf(result.getResolvedException()));
		assertTrue(result.getResponse().getContentAsString().contains("\"tNoteNo\":\"QA-AUTH-FIX-20261004\""));
	}

	@Test
	void transformerRequestAcceptsAnIdempotencyKey() throws Exception {
		when(tokenVerifier.verifyAdminToken("unit-test-token"))
				.thenReturn(Optional.of("admin@example.com"));
		when(googleSheetsService.createTransformer(any(), any(), any(), anyInt(), any(), anyDouble(),
				any(), any(), any()))
				.thenReturn(new TransformerDTO(
						1L, "QA", "QA-DTR", "QA-SN", 100, "Distribution", 50, "Recieved", 1L, null, null));

		mockMvc.perform(post("/api/transformers")
						.header("Authorization", "Bearer unit-test-token")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"spmCenter\":\"QA\",\"dtrNo\":\"QA-DTR\",\"sNo\":\"QA-SN\",\"capacity\":100,\"type\":\"Distribution\",\"oilCapacity\":50,\"tNoteId\":1,\"intakeType\":\"NEW\",\"requestId\":\"request-123\"}"))
				.andExpect(status().isOk());

		verify(googleSheetsService).createTransformer(
				eq("QA"), eq("QA-DTR"), eq("QA-SN"), eq(100), eq("Distribution"), eq(50.0),
				eq(1L), eq("NEW"), eq("request-123"));
	}

	@Test
	void duplicateTransformerLinksDoNotInflateTNoteCount() {
		var transformer = new TransformerDTO(
				1L, "QA", "QA-DTR", "QA-SN", 100, "Distribution", 50, "Recieved", 1L, null, null);
		var tNote = new TNoteDTO(1L, LocalDate.of(2026, 10, 5), 3,
				java.util.List.of(transformer, transformer, transformer));

		var normalized = GoogleSheetsService.normalizeTNoteTransformers(tNote);

		assertEquals(1, normalized.getNumberOfTransformers());
		assertEquals(1, normalized.getTransformers().size());
		assertEquals(1L, normalized.getTransformers().get(0).getId());
	}
}
