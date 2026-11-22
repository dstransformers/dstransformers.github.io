package com.vstms.backend;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GoogleSheetsServiceRetryTests {

    @Test
    void retriesTransientFailureForReadOnlyAction() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        HttpServer server = startServer(exchange -> {
            if (calls.incrementAndGet() == 1) {
                respond(exchange, 502, "Bad Gateway");
            } else {
                respond(exchange, 200, "{\"status\":\"SUCCESS\",\"data\":[]}");
            }
        });

        try {
            GoogleSheetsService service = serviceFor(server);
            Map<String, Object> response = service.postToAppsScript(Map.of("action", "GET_ENQUIRIES"));

            assertEquals("SUCCESS", response.get("status"));
            assertEquals(2, calls.get());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void retriesTransientAppsScriptErrorForReadOnlyAction() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        HttpServer server = startServer(exchange -> {
            if (calls.incrementAndGet() == 1) {
                respond(exchange, 200, "{\"status\":\"ERROR\",\"message\":\"Service invoked too many times\"}");
            } else {
                respond(exchange, 200, "{\"status\":\"SUCCESS\",\"data\":[]}");
            }
        });

        try {
            GoogleSheetsService service = serviceFor(server);
            Map<String, Object> response = service.postToAppsScript(Map.of("action", "GET_ENQUIRIES"));

            assertEquals("SUCCESS", response.get("status"));
            assertEquals(2, calls.get());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void doesNotRetryMutationAfterTransientFailure() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        HttpServer server = startServer(exchange -> {
            calls.incrementAndGet();
            respond(exchange, 502, "Bad Gateway");
        });

        try {
            GoogleSheetsService service = serviceFor(server);
            Map<String, Object> response = service.postToAppsScript(Map.of("action", "ADD_ENQUIRY"));

            assertEquals("ERROR", response.get("status"));
            assertEquals(1, calls.get());
        } finally {
            server.stop(0);
        }
    }

    private static GoogleSheetsService serviceFor(HttpServer server) {
        GoogleSheetsService service = new GoogleSheetsService();
        ReflectionTestUtils.setField(service, "appsScriptUrl",
                "http://127.0.0.1:" + server.getAddress().getPort() + "/");
        ReflectionTestUtils.setField(service, "appsScriptRequestTimeout", Duration.ofSeconds(5));
        ReflectionTestUtils.setField(service, "appsScriptSharedSecret", "test-only-shared-secret-with-at-least-32-characters");
        return service;
    }

    private static HttpServer startServer(com.sun.net.httpserver.HttpHandler handler) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", handler);
        server.start();
        return server;
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        try (var output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }
}
