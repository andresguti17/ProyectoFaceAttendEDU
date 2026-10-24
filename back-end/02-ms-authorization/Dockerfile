# syntax=docker/dockerfile:1
# Build context: back-end/ (the image also needs the shared auth library).
FROM maven:3.9-eclipse-temurin-21-alpine AS builder
COPY shared/auth-java /shared/auth-java
RUN mvn -B -q -f /shared/auth-java/pom.xml install -DskipTests
WORKDIR /build
COPY 02-ms-authorization/pom.xml .
RUN mvn dependency:go-offline -B
COPY 02-ms-authorization/src ./src
RUN mvn package -B

FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache curl && addgroup -S app && adduser -S app -G app
COPY --from=builder /build/target/*.jar /app.jar
USER app
EXPOSE 8082
ENTRYPOINT ["java","-jar","/app.jar"]
