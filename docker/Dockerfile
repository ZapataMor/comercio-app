FROM php:8.4-fpm-bookworm AS php-base
RUN apt-get update && apt-get install -y --no-install-recommends \
    libicu-dev libzip-dev libpng-dev libjpeg62-turbo-dev libfreetype6-dev libonig-dev libsqlite3-dev unzip git \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j2 pdo_mysql pdo_sqlite mbstring intl zip gd opcache pcntl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/html

FROM php-base AS source
COPY backend/ .
RUN mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache

FROM source AS test
RUN touch .env && composer install --no-interaction --prefer-dist --optimize-autoloader
ENV APP_ENV=testing APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
CMD ["php", "artisan", "test", "--compact"]

FROM source AS vendor
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader

FROM node:22-bookworm-slim AS assets
WORKDIR /build
COPY backend/package*.json ./
RUN npm ci
COPY backend/vite.config.js ./
COPY backend/resources ./resources
RUN npm run build

FROM vendor AS runtime
COPY --from=assets /build/public/build ./public/build
COPY docker/php-fpm-timeout.conf /usr/local/etc/php-fpm.d/zz-timeout.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/production.ini
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/vitrina-entrypoint
RUN php artisan storage:link && chown -R www-data:www-data storage bootstrap/cache
USER www-data
ENTRYPOINT ["vitrina-entrypoint"]
CMD ["php-fpm"]

FROM nginx:1.28-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=runtime /var/www/html/public /var/www/html/public
