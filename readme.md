# HeFeng Weather MCP Server

A Model Context Protocol server that provides weather forecast data for locations in China through HeFeng Weather API.

## Features

- Get real-time weather data
- Get hourly weather forecast (24h/72h/168h)
- Get daily weather forecast (3d/7d/10d/15d/30d)
- Support location query by longitude and latitude coordinates
- Full Chinese weather description

## API

This MCP server provides the following tool:

### get-weather

Get weather forecast data for a specific location.

# Usage with MCP Host(eg. Claude Desktop)

Add this to your claude_desktop_config.json

## NPX

```json
{
  "mcpServers": {
    "hefeng-weather": {
      "command": "npx",
      "args": ["hefeng-mcp-weather@latest", "--apiKey=${API_KEY}"]
    }
  }
}
```

# License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.
