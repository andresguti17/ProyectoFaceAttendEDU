# FaceAttend DB Test

Proyecto de migraciones de base de datos con Liquibase para PostgreSQL.

## Objetivo

Este repositorio gestiona la creación del schema `identity`, los tipos, tablas, vistas y demás cambios estructurales necesarios para la base de datos del proyecto FaceAttend.

## Estructura principal

- `01-ddl/`: definiciones de schema, tipos y objetos DDL
- `02-dml/`: cambios de datos
- `03-dcl/`: permisos, roles y grants
- `04-tcl/`: bloques transaccionales
- `05-rollbacks/`: scripts de reversión
- `changelog/changelog-master.yaml`: punto de entrada principal

## Requisitos

- Docker Desktop o Docker Engine
- Docker Compose

## Ejecutar la base de datos

Desde la raíz del proyecto:

```bash
docker compose up -d postgres
```

Esto levanta PostgreSQL en el puerto `5432` con la base de datos `faceattend_db`.

## Aplicar migraciones con Liquibase

```bash
docker compose up liquibase
```

Esto aplica el changelog principal desde:

```bash
changelog/changelog-master.yaml
```

## Verificar estado

```bash
docker compose ps
```

Y para ver logs de Liquibase:

```bash
docker compose logs -f liquibase
```

## Reaplicar o limpiar

Para limpiar el entorno:

```bash
docker compose down -v
```

## Orden de ejecución de migraciones

1. Crear schema `identity`
2. Crear tipo `identity.blood_type`
3. Crear tablas:
   - `identity.school`
   - `identity.person`
   - `identity."user"`
   - `identity.user_session`
4. Aplicar cambios adicionales (vistas, DML, DCL, etc.)

## Conexión local

URL del PostgreSQL para conexión local:

```text
postgresql://postgres:postgres@localhost:5432/db_test
```
