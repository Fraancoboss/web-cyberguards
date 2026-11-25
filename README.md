# CyberGuards – AI · web

Web estática, sin frameworks ni dependencias. Pesa unos 200 KB en total (de ellos, 165 KB son fuentes), no usa cookies ni rastreadores y la animación del hero se pausa cuando no está en pantalla.

```
index.html          Página principal
404.html            Página de error
assets/css/         Estilos
assets/js/main.js   Animación del hero (canvas) y slot opcional de vídeo
assets/fonts/       Bricolage Grotesque + Atkinson Hyperlegible Next (SIL OFL 1.1, alojadas en local)
assets/img/         Logo y favicon
_headers            Cabeceras de seguridad (solo Cloudflare Pages)
```

## Probar en local

```bash
python -m http.server 8080
# http://localhost:8080
```

## Usar un vídeo real en el hero

1. Copia el vídeo a `assets/video/hero.mp4` (recomendado: H.264, 1080p, < 4 MB, sin audio, en bucle).
2. En `index.html`, cambia `data-video=""` por `data-video="assets/video/hero.mp4"`.

Los bordes se difuminan solos con la máscara CSS. Si no hay vídeo, se usa la animación generativa.

## Cambiar el email de contacto

Busca `contacto@cyberguards.ai` en `index.html` (aparece dos veces).

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
