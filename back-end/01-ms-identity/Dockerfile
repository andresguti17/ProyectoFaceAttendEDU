# syntax=docker/dockerfile:1
# Build context: back-end/ (the image also needs the shared auth library).
FROM maven:3.9-eclipse-temurin-21-alpine@sha256:308cba8b638ed7e4658cea3f8399066219466211c805f6d5728c3c9c7614661b AS builder
COPY shared/auth-java /shared/auth-java
RUN for i in 1 2 3; do mvn -B -q -f /shared/auth-java/pom.xml install -DskipTests && exit 0; sleep $((i * 20)); done; exit 1
WORKDIR /build
COPY 01-ms-identity/pom.xml .
RUN for i in 1 2 3; do mvn dependency:go-offline -B && exit 0; sleep $((i * 20)); done; exit 1
COPY 01-ms-identity/src ./src
RUN for i in 1 2 3; do mvn package -B && exit 0; sleep $((i * 20)); done; exit 1

FROM eclipse-temurin:21-jre-alpine@sha256:b48e02e0ea88d7bfb305335df94923bdef394905f4147dccd52e873cf17b1088
RUN apk add --no-cache curl && addgroup -S app && adduser -S app -G app
COPY --from=builder /build/target/*.jar /app.jar
USER app
EXPOSE 8081
ENTRYPOINT ["java","-jar","/app.jar"]
