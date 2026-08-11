FROM nginx:1.27-alpine

# Remove the default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom configuration
COPY deploy/docker/nginx.conf /etc/nginx/conf.d/mahaffeys.conf