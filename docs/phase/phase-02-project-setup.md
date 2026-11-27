# Phase 2: Project Setup and Infrastructure

> **Project:** FleetFlow Car Rental & Fleet Management System
> **Phase type:** Setup (first real code, but no business features)
> **Where this file lives:** `docs/phases/phase-02-project-setup.md`
> **Needs:** Phase 1 complete (`architecture.md` tells you the packages and tools to use)
> **Status:** Finish the checklist at the bottom before starting Phase 3.

---

## 1. What is this phase?

Phase 2 builds an **empty but running skeleton**:

- PostgreSQL runs in Docker.
- The Spring Boot backend starts and connects to the database.
- Swagger opens in the browser.
- The React frontend opens and can call the backend.
- Error handling and response format are ready for all later modules.

No vehicles, no bookings, no login yet. The goal is that **every tool works together** so you never fight setup problems while writing real features.

**Why it matters**

- Setup mistakes (wrong Java version, port conflicts, CORS errors) are easier to fix when there is no other code.
- The common classes you write here (`ApiResponse`, exceptions) are used by every module in Phases 4 to 10.
- A clean skeleton makes your Git history look professional.

**What you will have at the end**

| Part | Proof it works |
|---|---|
| Database | `docker ps` shows `fleetflow-db` running |
| Backend | `http://localhost:8080/api/health` returns OK |
| API docs | `http://localhost:8080/swagger-ui/index.html` opens |
| Frontend | `http://localhost:5173` opens and shows the backend status |

---

## 2. Before you start: check your tools

Open Command Prompt or PowerShell and run each command:

```
java -version
mvn -version
node -v
npm -v
docker --version
docker compose version
git --version
```

| Tool | Needed version | If missing |
|---|---|---|
| Java (JDK) | 21 | Install Temurin JDK 21 from adoptium.net |
| Maven | 3.9 or newer | Install from maven.apache.org, add `bin` to PATH |
| Node.js | 20 or newer | Install the LTS version from nodejs.org |
| Docker Desktop | Latest | Install, then start it and wait until it says "running" |
| Git | Any recent | Install from git-scm.com |

**Important checks**

- `java -version` must show 21. If it shows 17 or 8, set `JAVA_HOME` to the JDK 21 folder and reopen the terminal.
- `mvn -version` must also show Java 21 in its output.
- Docker Desktop must be running before any `docker` command.

**Editors:** IntelliJ IDEA (Community is enough) for the backend and VS Code for the frontend work well.

---

## 3. Your repo structure for this phase

```
fleetflow-car-rental-system/
  backend/
    pom.xml
    src/
      main/
        java/com/fleetflow/
          FleetflowApplication.java
          common/
            dto/ApiResponse.java
            exception/ResourceNotFoundException.java
            exception/BusinessRuleException.java
            exception/GlobalExceptionHandler.java
          config/
            OpenApiConfig.java
            CorsConfig.java
            SecurityConfig.java          (temporary, replaced in Phase 4)
          health/HealthController.java   (temporary test endpoint)
        resources/
          application.yml
          application-dev.yml
          application-prod.yml
          db/migration/.gitkeep
      test/java/com/fleetflow/
  frontend/
    package.json
    index.html
    vite.config.ts
    tailwind.config.js
    postcss.config.js
    src/
      main.tsx
      App.tsx
      index.css
      api/axiosClient.ts
      routes/AppRoutes.tsx
      pages/HomePage.tsx
      components/  context/  types/  utils/  hooks/
  docker/
  docker-compose.yml
  .env.example
  .gitignore
  README.md
```

You already have `backend`, `docker`, `docs`, `frontend`, `docker-compose.yml`, `.env.example`, `.gitignore` and `README.md` from Phase 1. This phase fills them.

Start a branch for this phase:

```
cd fleetflow-car-rental-system
git checkout main
git pull
git checkout -b phase-2-setup
```

---

## 4. Step-by-step work

### Step 1: Prepare the `.gitignore` and `.env.example`

**What:** Make sure secrets and build files never go into Git.

**How:** Open `.gitignore` and make sure it contains at least:

```
# Environment and secrets
.env

# Java / Maven
backend/target/
*.class
*.log

# IDE
.idea/
*.iml
.vscode/

# Node
frontend/node_modules/
frontend/dist/

# OS
.DS_Store
Thumbs.db
```

Now edit `.env.example`. It lists **names and safe sample values only**:

```
# Database
POSTGRES_DB=fleetflow
POSTGRES_USER=fleetflow
POSTGRES_PASSWORD=change_me_local_only

# Backend (used in Phase 4 and in production)
JWT_SECRET=change_me_to_a_long_random_value_at_least_32_chars
```

Create your real `.env` file by copying it:

```
copy .env.example .env
```

Then edit `.env` and choose your own password. `.env` is ignored by Git; `.env.example` is committed.

---

### Step 2: Start PostgreSQL with Docker Compose

**What:** Run the database in a container so you do not install PostgreSQL on Windows.

**How:** Open `docker-compose.yml` in the repo root and write:

```yaml
services:
  db:
    image: postgres:16
    container_name: fleetflow-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - fleetflow-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  fleetflow-db-data:
```

Docker Compose reads `${...}` values from the `.env` file in the same folder.

Start it:

```
docker compose up -d
docker ps
```

You should see `fleetflow-db` with status `Up` (and `healthy` after a few seconds).

**Test the connection from inside the container:**

```
docker exec -it fleetflow-db psql -U fleetflow -d fleetflow -c "SELECT 1;"
```

If it prints a table with `1`, the database works.

**Useful commands to remember**

| Command | Meaning |
|---|---|
| `docker compose up -d` | Start in the background |
| `docker compose down` | Stop (data is kept) |
| `docker compose down -v` | Stop and **delete all data** (fresh start) |
| `docker compose logs db` | See database logs |

**The `docker/` folder:** keep it empty for now (add a `.gitkeep` file). In Phase 12 it will hold extra Docker files if you need them.

---

### Step 3: Create the Spring Boot backend project

**What:** Generate a Maven project with the correct dependencies.

**How (option A, recommended): Spring Initializr website**

1. Open https://start.spring.io
2. Choose:
   - Project: **Maven**
   - Language: **Java**
   - Spring Boot: latest stable **3.x** (not a snapshot, not 4.x)
   - Group: `com.fleetflow`
   - Artifact: `backend`
   - Packaging: **Jar**
   - Java: **21**
3. Add these dependencies:
   - Spring Web
   - Spring Security
   - Spring Data JPA
   - Validation
   - PostgreSQL Driver
   - Flyway Migration
   - Lombok
4. Click **Generate**, unzip, and copy the **contents** into your `backend/` folder so that `backend/pom.xml` exists.

Rename the main class to `FleetflowApplication` if you like, and make sure it sits in the package `com.fleetflow` (all other packages go below it, so Spring finds them).

**Add two more dependencies to `backend/pom.xml`** inside `<dependencies>`:

```xml
<!-- Swagger / OpenAPI -->
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.6.0</version>
</dependency>

<!-- Flyway support for PostgreSQL (needed by newer Flyway versions) -->
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-database-postgresql</artifactId>
</dependency>
```

Check the current 2.x version of springdoc on its website if the build complains. The Flyway PostgreSQL module version is managed by Spring Boot, so you do not write a version.

**Check the Java version in `pom.xml`:**

```xml
<properties>
    <java.version>21</java.version>
</properties>
```

**Test that the project builds:**

```
cd backend
mvn clean compile
```

Expected: `BUILD SUCCESS`. The first run downloads libraries and may take a few minutes.

---

### Step 4: Write the configuration files

**What:** Tell the backend how to connect to the database and how to behave in each environment.

**How:** In `backend/src/main/resources/`, delete `application.properties` and create three YAML files.

**`application.yml`** (shared settings):

```yaml
spring:
  application:
    name: fleetflow
  profiles:
    active: dev
  jpa:
    hibernate:
      ddl-auto: validate      # Flyway creates tables, Hibernate only checks them
    open-in-view: false
    properties:
      hibernate:
        jdbc:
          time_zone: UTC
  flyway:
    enabled: true
    locations: classpath:db/migration

server:
  port: 8080

springdoc:
  swagger-ui:
    path: /swagger-ui.html
```

**`application-dev.yml`** (your computer):

```yaml
spring:
  datasource:
    url: ${DB_URL:jdbc:postgresql://localhost:5432/fleetflow}
    username: ${DB_USER:fleetflow}
    password: ${DB_PASSWORD:change_me_local_only}
  jpa:
    show-sql: true

logging:
  level:
    com.fleetflow: DEBUG
```

The `${DB_URL:default}` form means: use the environment variable if it exists, otherwise use the default after the colon. The default password must match the one in your `.env`. Spring Boot does not read `.env` by itself, so keep the defaults in sync or set the variables in IntelliJ (Run Configuration > Environment variables).

**`application-prod.yml`** (real deployment, no defaults for secrets):

```yaml
spring:
  datasource:
    url: ${DB_URL}
    username: ${DB_USER}
    password: ${DB_PASSWORD}
  jpa:
    show-sql: false

logging:
  level:
    com.fleetflow: INFO
```

**Migration folder:** create the folder `backend/src/main/resources/db/migration/` and put an empty file named `.gitkeep` inside so Git keeps the folder. Do **not** add a placeholder SQL file. Flyway will simply find no migrations until Phase 3.

---

### Step 5: Write the common backend classes

**What:** Shared building blocks used by every module.

**How:** Create each file below. Package names must match the folder.

**`common/dto/ApiResponse.java`**: one response shape for the whole API.

```java
package com.fleetflow.common.dto;

public record ApiResponse<T>(boolean success, String message, T data) {

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, "OK", data);
    }

    public static <T> ApiResponse<T> ok(String message, T data) {
        return new ApiResponse<>(true, message, data);
    }

    public static <T> ApiResponse<T> fail(String message) {
        return new ApiResponse<>(false, message, null);
    }
}
```

**`common/exception/ResourceNotFoundException.java`**: used when an id does not exist (or belongs to another organization).

```java
package com.fleetflow.common.exception;

public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
```

**`common/exception/BusinessRuleException.java`**: used when a business rule fails, for example double booking.

```java
package com.fleetflow.common.exception;

public class BusinessRuleException extends RuntimeException {
    public BusinessRuleException(String message) {
        super(message);
    }
}
```

**`common/exception/GlobalExceptionHandler.java`**: turns exceptions into clean JSON.

```java
package com.fleetflow.common.exception;

import com.fleetflow.common.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(404).body(ApiResponse.fail(ex.getMessage()));
    }

    @ExceptionHandler(BusinessRuleException.class)
    public ResponseEntity<ApiResponse<Void>> handleRule(BusinessRuleException ex) {
        return ResponseEntity.status(409).body(ApiResponse.fail(ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleInvalid(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest().body(ApiResponse.fail(message));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleOther(Exception ex) {
        // Log the real error on the server, but do not show internal details to the client
        ex.printStackTrace();
        return ResponseEntity.status(500).body(ApiResponse.fail("Something went wrong. Please try again."));
    }
}
```

Note: in Phase 4, access-denied and authentication errors need their own handlers so they return 403 and 401 instead of 500. Remember this when you reach Phase 4.

**`health/HealthController.java`**: a temporary test endpoint.

```java
package com.fleetflow.health;

import com.fleetflow.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    @GetMapping
    public ApiResponse<Map<String, String>> health() {
        return ApiResponse.ok(Map.of("status", "UP", "service", "fleetflow-backend"));
    }
}
```

---

### Step 6: Write the config classes

**`config/SecurityConfig.java`**: temporary. Spring Security blocks everything by default, so for now allow all requests. **Phase 4 replaces this file** with real JWT security.

```java
package com.fleetflow.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)      // we use tokens, not browser sessions
            .cors(Customizer.withDefaults())
            .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());   // TEMPORARY
        return http.build();
    }
}
```

**`config/CorsConfig.java`**: lets the React app (port 5173) call the backend (port 8080).

```java
package com.fleetflow.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class CorsConfig {

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:5173"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
```

**`config/OpenApiConfig.java`**: title for Swagger, and a place for the future JWT "Authorize" button.

```java
package com.fleetflow.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI fleetflowOpenApi() {
        return new OpenAPI().info(new Info()
                .title("FleetFlow API")
                .version("v1")
                .description("Car Rental & Fleet Management System"));
    }
}
```

---

### Step 7: Run the backend and test it

**How:**

```
cd backend
mvn spring-boot:run
```

Or run `FleetflowApplication` from IntelliJ (green play button).

**Expected in the console:** a line like `Started FleetflowApplication in ... seconds` and `Tomcat started on port 8080`. You may also see a Flyway message that there are no migrations. That is fine.

**Test in the browser:**

1. `http://localhost:8080/api/health` should show:

```json
{"success":true,"message":"OK","data":{"status":"UP","service":"fleetflow-backend"}}
```

2. `http://localhost:8080/swagger-ui/index.html` should open the Swagger page and list `health-controller`.

Stop the server with `Ctrl+C`.

---

### Step 8: Create the React frontend project

**What:** A Vite + React + TypeScript project with Tailwind CSS.

**How:** Your `frontend/` folder may already contain placeholder files. If it is empty or only has a `.gitkeep`, run:

```
cd frontend
npm create vite@latest . -- --template react-ts
```

If Vite asks about a non-empty folder, choose to continue after making sure nothing important is inside.

Install the packages:

```
npm install
npm install axios react-router-dom
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

Note: this guide uses **Tailwind v3** because the `init -p` setup is simple and stable. Tailwind v4 uses a different setup. Do not mix the two.

**`tailwind.config.js`:**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

**`src/index.css`**: replace everything with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Make sure `src/main.tsx` imports it: `import "./index.css";`

**Create the folders:**

```
cd src
mkdir api pages components context routes types utils hooks
```

---

### Step 9: Frontend base files

**`src/api/axiosClient.ts`**: one place for the backend address and the future login token.

```ts
import axios from "axios";

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8080/api",
  headers: { "Content-Type": "application/json" },
});

// Phase 4 will use this to send the login token automatically
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosClient;
```

Create `frontend/.env.example` with `VITE_API_URL=http://localhost:8080/api`. Vite only exposes variables that start with `VITE_`.

**`src/pages/HomePage.tsx`**: a temporary page that proves frontend and backend talk to each other.

```tsx
import { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";

type Health = { status: string; service: string };

export default function HomePage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axiosClient
      .get("/health")
      .then((res) => setHealth(res.data.data))
      .catch(() => setError("Cannot reach the backend. Is it running on port 8080?"));
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50">
      <h1 className="text-3xl font-bold">FleetFlow</h1>
      <p className="text-gray-600">Car Rental & Fleet Management System</p>
      {health && (
        <p className="text-green-700">
          Backend status: {health.status} ({health.service})
        </p>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
```

**`src/routes/AppRoutes.tsx`:**

```tsx
import { Route, Routes } from "react-router-dom";
import HomePage from "../pages/HomePage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  );
}
```

**`src/App.tsx`:**

```tsx
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
```

Remove the default Vite demo files you do not use (`App.css`, the logo assets, the counter code).

---

### Step 10: Run everything together

Use three terminals:

| Terminal | Folder | Command |
|---|---|---|
| 1 | repo root | `docker compose up -d` |
| 2 | `backend` | `mvn spring-boot:run` |
| 3 | `frontend` | `npm run dev` |

Open `http://localhost:5173`. You should see the FleetFlow title and the green line **Backend status: UP (fleetflow-backend)**.

If you see the red error, check the "Common problems" table below.

---

### Step 11: Update the README

Open the root `README.md` and add a section **How to run locally** with the commands from Step 10, the list of required tools, and the URLs (frontend 5173, backend 8080, Swagger). Change the status line to **Phase 2 complete**. Update `docs/phases/README.md`: Phase 2 = Done.

---

## 5. Files created or changed in this phase

| File | Action |
|---|---|
| `.gitignore` | Check and complete |
| `.env.example` | Fill with names and safe sample values |
| `.env` | Create locally (never committed) |
| `docker-compose.yml` | PostgreSQL service with healthcheck |
| `backend/pom.xml` | Generated, plus springdoc and Flyway PostgreSQL module |
| `backend/src/main/resources/application*.yml` | Three config files |
| `backend/src/main/resources/db/migration/.gitkeep` | Empty folder holder |
| `common/dto/ApiResponse.java` | New |
| `common/exception/*.java` (3 files) | New |
| `health/HealthController.java` | New (temporary) |
| `config/SecurityConfig.java` | New (temporary, replaced in Phase 4) |
| `config/CorsConfig.java`, `config/OpenApiConfig.java` | New |
| `frontend/` project files | Generated by Vite, then edited |
| `frontend/src/api/axiosClient.ts` | New |
| `frontend/src/pages/HomePage.tsx`, `routes/AppRoutes.tsx`, `App.tsx` | New or edited |
| `README.md`, `docs/phases/README.md` | Updated |

---

## 6. Common problems and fixes

| Problem | Likely cause | Fix |
|---|---|---|
| `Port 5432 is already allocated` | A local PostgreSQL is already running | Stop that service, or change the left side of the port to `5433:5432` and update `DB_URL` |
| `docker: error during connect` | Docker Desktop is not running | Start Docker Desktop and wait until it is ready |
| Backend: `Connection refused` to the database | Container not started or wrong port | Run `docker ps`; check the URL in `application-dev.yml` |
| Backend: `password authentication failed` | Password differs between `.env` and `application-dev.yml` | Make them match, then run `docker compose down -v` and `up -d` again (the old password stays in the volume) |
| `release version 21 not supported` | Maven is using an older Java | Set `JAVA_HOME` to JDK 21, reopen the terminal, check `mvn -version` |
| `Unsupported Database: PostgreSQL 16` from Flyway | Missing Flyway PostgreSQL module | Add `flyway-database-postgresql` to `pom.xml` |
| Swagger shows a blank page or 404 | Springdoc version not compatible with your Spring Boot | Use the springdoc 2.x line that matches Spring Boot 3.x |
| Browser console: `blocked by CORS policy` | Origin not allowed | Check `CorsConfig` allows `http://localhost:5173`; the frontend must use that exact address |
| Frontend shows "Cannot reach the backend" | Backend not running or wrong URL | Start the backend; check `VITE_API_URL` |
| `Cannot find module 'tailwindcss'` or no styles | Tailwind not configured | Check `content` paths in `tailwind.config.js` and the three `@tailwind` lines |
| Everything works but you see `401` | Security config missing the `permitAll` line | Check `SecurityConfig` (temporary version) |

---

## 7. How to check your work (Done when)

- [ ] `java -version` shows 21 and `mvn -version` uses Java 21
- [ ] `docker ps` shows `fleetflow-db` as `Up` and healthy
- [ ] `mvn clean compile` in `backend` ends with `BUILD SUCCESS`
- [ ] Backend starts with no red errors in the console
- [ ] `http://localhost:8080/api/health` returns the JSON with `"success":true`
- [ ] `http://localhost:8080/swagger-ui/index.html` opens
- [ ] `npm run dev` starts and `http://localhost:5173` opens
- [ ] The frontend page shows **Backend status: UP**
- [ ] `npm run build` in `frontend` finishes with no errors
- [ ] `.env` is **not** shown by `git status` (it is ignored)
- [ ] You can stop everything and start it again from the README steps only

**Self-test questions (answer without looking):**

1. Why is `ddl-auto` set to `validate` and not `update`?
2. What does `docker compose down -v` do, and when would you use it?
3. Why do we need CORS between port 5173 and port 8080?
4. Why is `SecurityConfig` marked as temporary?
5. Which file decides which database the backend connects to in development?

---

## 8. Commit

```
git status
git add .
git commit -m "chore: set up Spring Boot, React, PostgreSQL and Docker skeleton"
git push -u origin phase-2-setup
```

Before committing, run `git status` and make sure no `.env`, `target/` or `node_modules/` files appear. Open a pull request, check the changed files on GitHub, and merge into `main`.

---

## 9. What connects to the next phase

| Phase 2 output | Used in |
|---|---|
| Docker database | Phase 3 (Flyway runs migrations on it) |
| `application*.yml` | Phase 3 (JPA and Flyway), Phase 4 (JWT settings), Phase 12 (production) |
| `ApiResponse` and exceptions | Every controller and service from Phase 4 on |
| `GlobalExceptionHandler` | Phase 4 adds 401 and 403 handling here |
| `SecurityConfig` (temporary) | Phase 4 replaces it completely |
| `CorsConfig` | Phase 12 changes the allowed origin for production |
| `axiosClient.ts` | Phase 4 adds login handling, Phase 11 adds global error handling |
| Folder structure in `src/` | All frontend phases |

**Next:** [Phase 3: Database design and migrations](phase-03-database-migrations.md)
