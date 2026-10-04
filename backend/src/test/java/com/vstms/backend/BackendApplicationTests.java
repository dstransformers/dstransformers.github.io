package com.vstms.backend;

import com.vstms.backend.security.FirebaseTokenVerifier;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

	@Test
	void contextLoads() {
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
}
