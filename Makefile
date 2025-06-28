all:build

build:
	@clear
	@echo "Stopping Cached Docker containers..."
	docker-compose -f docker-compose.dev.yml down
	@echo "Building and starting Docker containers..."
	docker-compose -f docker-compose.dev.yml up --build