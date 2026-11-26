# CyberGuards – AI · web

Web estática, sin build ni dependencias externas en producción: todo (fuentes y librerías) se sirve desde el propio dominio. Sin cookies ni rastreadores.

```
index.html               Página principal
404.html                 Página de error
.well-known/security.txt Divulgación responsable de vulnerabilidades (RFC 9116)
assets/css/styles.css    Sistema visual (negro, rojo señal, Geist)
assets/js/boot.js        Se ejecuta antes del primer pintado: activa estilos JS e intro
assets/js/app.js         Movimiento e interacción (GSAP, ScrollTrigger, SplitText, Lenis)
assets/js/hero3d.js      Escena 3D del hero: escudo metálico, perímetro y ataques bloqueados
assets/js/morph3d.js     Figura de partículas de servicios: esfera → nudo → escudo
assets/vendor/           three.js r170 (MIT), GSAP 3.13 (licencia estándar GSAP, gratuita), Lenis 1.3 (MIT)
assets/fonts/            Geist, Geist Mono y Chakra Petch (SIL OFL 1.1)
_headers                 Cabeceras de seguridad (solo Cloudflare Pages)
```

## Probar en local

Los módulos ES no funcionan abriendo el fichero directamente; hace falta un servidor:

```bash
python -m http.server 8080
# http://localhost:8080
```

## Rendimiento y accesibilidad

- Las escenas 3D solo se renderizan cuando están en pantalla y con la pestaña visible.
- Con «reducir movimiento» activado en el sistema no hay intro, scroll suave ni animaciones: se pinta un fotograma estático.
- La intro se muestra una vez por sesión.
- Sin WebGL, el hero muestra el logo con un halo rojo.

## Cambiar el email de contacto

Busca `contacto@cyberguards.ai` en `index.html` (todas las apariciones) y en `.well-known/security.txt`.

---

## Despliegue

### Opción A: GitHub Pages (ya configurado)

Cada `git push` a `main` publica la web automáticamente.

**Dominio propio con DNS en DonDominio**

1. Crea un fichero `CNAME` en la raíz con el dominio (`ejemplo.com`), haz commit y push.
2. En DonDominio → *Dominios* → tu dominio → *Zona DNS*, añade:

| Tipo  | Nombre | Valor                    |
|-------|--------|--------------------------|
| A     | @      | 185.199.108.153          |
| A     | @      | 185.199.109.153          |
| A     | @      | 185.199.110.153          |
| A     | @      | 185.199.111.153          |
| AAAA  | @      | 2606:50c0:8000::153      |
| AAAA  | @      | 2606:50c0:8001::153      |
| AAAA  | @      | 2606:50c0:8002::153      |
| AAAA  | @      | 2606:50c0:8003::153      |
| CNAME | www    | `<usuario>.github.io.`   |

   Borra antes cualquier registro A/AAAA previo de `@` (por ejemplo, el del parking de DonDominio).
3. En GitHub → *Settings → Pages*, escribe el dominio y, cuando el certificado esté listo, marca **Enforce HTTPS**.

### Opción B: Cloudflare Pages (manteniendo los DNS en DonDominio)

1. Crea una cuenta en https://dash.cloudflare.com/sign-up.
2. *Workers & Pages → Create → Pages → Connect to Git* → elige este repositorio.
3. Configuración de build: **Framework preset:** None · **Build command:** (vacío) · **Output directory:** `/`.
4. Obtendrás una URL `cyberguards-web.pages.dev` (o similar).
5. *Custom domains → Set up a custom domain* → `www.ejemplo.com`.
6. En DonDominio, en *Zona DNS*: `CNAME  www  →  <proyecto>.pages.dev.`
7. Para el dominio raíz (`ejemplo.com`), usa en DonDominio la **redirección web** de `ejemplo.com` a `https://www.ejemplo.com`.

> Cloudflare Pages solo acepta dominios raíz (apex) si los DNS están en Cloudflare. Con los DNS en DonDominio hay que publicar en `www` y redirigir el raíz, como se indica arriba. Ventaja frente a GitHub Pages: aplica las cabeceras de seguridad de `_headers`.

**Importante:** usad solo una de las dos opciones para el mismo dominio.
