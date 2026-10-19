# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-21-alpine AS builder
WORKDIR /build
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -B

FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache curl && addgroup -S app && adduser -S app -G app
COPY --from=builder /build/target/*.jar /app.jar
USER app
EXPOSE 8085
# JAVA_OPTS inyectable desde compose (p. ej. -Xmx768m): sin él la JVM
# dimensiona el heap a ~1/4 del límite del contenedor y los findAll
# históricos lo agotaban (OutOfMemoryError con ~81k registros).
ENTRYPOINT ["sh","-c","exec java $JAVA_OPTS -jar /app.jar"]
