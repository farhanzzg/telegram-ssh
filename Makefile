.PHONY: all build clean install binary linux macos windows release

all: build

build:
	@echo "Compiling TypeScript..."
	@npx tsc
	@echo "Build complete!"

clean:
	@rm -rf dist build
	@echo "Cleaned build artifacts"

install:
	@npm install

binary: build
	@echo "Creating binary executable..."
	@npx pkg . --targets node18-linux-x64 --output build/telegram-ssh-bot
	@chmod +x build/telegram-ssh-bot
	@echo "Binary created: build/telegram-ssh-bot"

linux: build
	@npx pkg . --targets node18-linux-x64 --output build/telegram-ssh-bot-linux
	@chmod +x build/telegram-ssh-bot-linux

macos: build
	@npx pkg . --targets node18-macos-x64 --output build/telegram-ssh-bot-macos

windows: build
	@npx pkg . --targets node18-win-x64 --output build/telegram-ssh-bot.exe

release: clean install linux macos windows
	@echo "All release binaries created in build/"
