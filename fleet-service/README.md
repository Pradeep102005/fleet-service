# FleetPulse

FleetPulse is a predictive maintenance backend for a Connected Vehicle Intelligence hackathon project. It ingests vehicle telemetry, tracks health scores in Redis, and generates predictive maintenance alerts using a rule-based engine (to be replaced with an ML model later).

## Architecture

- **Spring Boot**: REST APIs and Kafka Consumers/Producers
- **Kafka**: Event streaming (`telemetry.raw`, `telemetry.clean`, `alerts`)
- **Redis**: Fast lookup for deduplication and EWMA health score rolling stats
- **PostgreSQL**: Persistent storage for fleets, vehicles, alerts, and maintenance records

## Prerequisites

- Java 17+
- Maven
- Docker and Docker Compose

## Running Locally

1. **Start the Infrastructure**

   We use a provided `docker-compose.yml` to spin up PostgreSQL, Redis, and Kafka (in KRaft mode). From the project root, run:

   ```bash
   docker compose up -d
   ```

2. **Start the Spring Boot Application**

   Once the containers are healthy, you can run the application using Maven:

   ```bash
   ./mvnw spring-boot:run
   ```
   *(On Windows, use `mvnw.cmd spring-boot:run`)*

   The application will start on `http://localhost:8080`. Flyway (or Hibernate auto-ddl) will automatically create the required database tables.

3. **Verify the Setup**

   You can verify the services are running by hitting the actuator health endpoint:
   
   ```bash
   curl http://localhost:8080/actuator/health
   ```

## Next Steps

- Test telemetry ingestion via `POST /api/v1/telemetry/ingest`
- View generated alerts via `GET /api/v1/alerts?status=open`
- Check vehicle health via `GET /api/v1/vehicles/{vin}/health`