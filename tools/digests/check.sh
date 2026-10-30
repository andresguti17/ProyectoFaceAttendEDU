#!/usr/bin/env bash
# Revisa si las imágenes fijadas como imagen:etiqueta@sha256:… cambiaron en el registro (B7).
#
#   tools/digests/check.sh                 # todos los Dockerfile y docker-compose*.yml del repositorio
#   tools/digests/check.sh <archivo>...    # solo esos archivos
#
# Para cada referencia consulta el digest que tiene hoy esa etiqueta (docker buildx imagetools inspect) y
# lo compara con el fijado. Imprime una tabla con las que cambiaron. No modifica ningún archivo: para
# actualizar una imagen, ver COMPOSE.md («Imágenes de terceros fijadas por digest»).
#
# Salida: 0 si todas siguen igual, 1 si alguna cambió, 2 si no se pudo consultar alguna (y ninguna cambió).
#
# Un digest fijado que no es el del índice multiplataforma sino el manifiesto de una plataforma
# (p. ej. linux/amd64) cuenta como igual mientras siga dentro del índice actual de la etiqueta.
# Las referencias sin etiqueta (imagen@sha256:…) no se pueden comparar con nada y solo se listan.
# Requiere docker con buildx y acceso al registro (Docker Hub, cgr.dev…).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REF_PATTERN='[A-Za-z0-9][A-Za-z0-9._/:_-]*@sha256:[a-f0-9]{64}'
# ${VAR:-imagen@sha256:…} de compose: se quita el prefijo para leer solo la imagen por defecto.
DEFAULT_PREFIX='\$\{[A-Za-z_][A-Za-z0-9_]*:?-'

if ! docker buildx version >/dev/null 2>&1; then
  echo "Hace falta docker con buildx (docker buildx imagetools inspect)." >&2
  exit 2
fi

files=()
if (($# > 0)); then
  files=("$@")
else
  while IFS= read -r f; do
    files+=("$ROOT/$f")
  done < <(git -C "$ROOT" ls-files | grep -E '(^|/)Dockerfile[^/]*$|(^|/)docker-compose[^/]*\.ya?ml$')
fi

# Referencias únicas con los archivos donde aparecen: "ref|archivo1, archivo2"
declare -A where=()
for f in "${files[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "No existe: $f" >&2
    exit 2
  fi
  rel="${f#"$ROOT"/}"
  while IFS= read -r ref; do
    if [[ -z "${where[$ref]:-}" ]]; then
      where[$ref]="$rel"
    elif [[ ", ${where[$ref]}, " != *", $rel, "* ]]; then
      where[$ref]="${where[$ref]}, $rel"
    fi
  done < <(sed -E "s/${DEFAULT_PREFIX}/ /g" "$f" | grep -oE "$REF_PATTERN" | sort -u)
done

if ((${#where[@]} == 0)); then
  echo "No hay referencias imagen@sha256 en los archivos revisados."
  exit 0
fi

# Digest actual de una etiqueta. Imprime "sha256:…" o nada si falla.
current_digest() {
  local image_tag="$1"
  docker buildx imagetools inspect "$image_tag" 2>/dev/null | awk '$1 == "Digest:" { print $2; exit }'
  return 0
}

# ¿El digest fijado es uno de los manifiestos de plataforma del índice actual?
digest_in_index() {
  local image_tag="$1"
  local pinned="$2"
  docker buildx imagetools inspect --raw "$image_tag" 2>/dev/null | grep -q "\"$pinned\""
  return $?
}

short() {
  local digest="$1"
  printf '%s' "${digest:0:19}"
  return 0
}

changed=()
failed=()
untagged=()
same=0

while IFS= read -r ref; do
  image_tag="${ref%@*}"
  pinned="${ref#*@}"
  # Sin etiqueta: el último componente (tras la última /) no tiene ':'
  last="${image_tag##*/}"
  if [[ "$last" != *:* ]]; then
    untagged+=("$image_tag|$(short "$pinned")|${where[$ref]}")
    continue
  fi
  latest="$(current_digest "$image_tag")"
  if [[ -z "$latest" ]]; then
    failed+=("$image_tag|$(short "$pinned")|${where[$ref]}")
  elif [[ "$latest" == "$pinned" ]] || digest_in_index "$image_tag" "$pinned"; then
    same=$((same + 1))
  else
    changed+=("$image_tag|$(short "$pinned")|$(short "$latest")|$latest|${where[$ref]}")
  fi
done < <(printf '%s\n' "${!where[@]}" | sort)

print_rows() {
  local title="$1"
  local header="$2"
  shift 2
  echo
  echo "$title"
  { echo "$header"; printf '%s\n' "$@"; } | column -t -s '|'
  return 0
}

echo "Referencias revisadas: ${#where[@]} (sin cambios: $same, cambiadas: ${#changed[@]}, sin consultar: ${#failed[@]}, sin etiqueta: ${#untagged[@]})"

if ((${#changed[@]} > 0)); then
  rows=()
  for row in "${changed[@]}"; do
    IFS='|' read -r image_tag pinned_short latest_short _ used_in <<<"$row"
    rows+=("$image_tag|$pinned_short|$latest_short|$used_in")
  done
  print_rows "Cambiaron:" "IMAGEN|FIJADO|ACTUAL|ARCHIVOS" "${rows[@]}"
  echo
  echo "Digest completo para actualizar:"
  for row in "${changed[@]}"; do
    IFS='|' read -r image_tag _ _ latest _ <<<"$row"
    echo "  $image_tag@$latest"
  done
fi

if ((${#failed[@]} > 0)); then
  print_rows "No se pudieron consultar (red, registro o etiqueta borrada):" "IMAGEN|FIJADO|ARCHIVOS" "${failed[@]}"
fi

if ((${#untagged[@]} > 0)); then
  print_rows "Sin etiqueta (no hay nada con qué comparar):" "IMAGEN|FIJADO|ARCHIVOS" "${untagged[@]}"
fi

if ((${#changed[@]} > 0)); then
  exit 1
elif ((${#failed[@]} > 0)); then
  exit 2
fi
exit 0
