{
  description = "OmniHub - Development environment for sensor data management platform";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Node.js and npm
            nodejs_22
            
            # Container runtime
            podman
            podman-compose
            
            # PostgreSQL client tools
            postgresql
            
            # Useful tools
            git
          ];

          shellHook = ''
            echo "🚀 OmniHub Development Environment"
            echo "=================================="
            echo ""
            
            # Setup .env files if they don't exist
            if [ ! -f .env ]; then
              echo "📝 Creating .env from .env.example..."
              cp .env.example .env
              echo "✅ Created .env"
            else
              echo "✅ .env already exists"
            fi
            
            if [ ! -f src/admin-dashboard/.env ]; then
              echo "📝 Creating src/admin-dashboard/.env from .env.example..."
              cp src/admin-dashboard/.env.example src/admin-dashboard/.env
              echo "✅ Created src/admin-dashboard/.env"
            else
              echo "✅ src/admin-dashboard/.env already exists"
            fi
            
            echo ""
            echo "📦 Available versions:"
            echo "   Node.js: $(node --version)"
            echo "   npm: $(npm --version)"
            echo "   Podman: $(podman --version | head -n1)"
            echo ""
            echo "🔧 Quick start:"
            echo "   1. Start infrastructure:  podman compose up -d"
            echo "      (or use: docker compose up -d)"
            echo ""
            echo "   2. Start admin dashboard:"
            echo "      cd src/admin-dashboard"
            echo "      npm install"
            echo "      npm run dev"
            echo ""
            echo "📚 Other useful commands:"
            echo "   • npm run build          - Build for production"
            echo "   • npm run check          - Type check"
            echo "   • npm run format         - Format code"
            echo "   • podman compose down    - Stop infrastructure"
            echo "   • podman compose logs    - View logs"
            echo ""
          '';

          # Set environment variables
          NODEJS_VERSION = "22";
          NPM_CONFIG_PREFIX = "$HOME/.npm-global";
          REGISTRY_AUTH_FILE="./.podman-auth.json";
        };
      }
    );
}
