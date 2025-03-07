import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const HEFENG_API_BASE = "https://api.qweather.com/v7";
const HEFENG_DEV_API_BASE = "https://devapi.qweather.com/v7";
let HEFENG_API_KEY = ""; // 默认API密钥
let IS_DEV_MODE = false; // 添加开发模式标志

const apiKeyArg = process.argv.find(arg => arg.startsWith('--apiKey='));
if (apiKeyArg) {
    const apiKey = apiKeyArg.split('=')[1];
    if (apiKey) {
        console.log(`使用命令行参数中的API密钥: ${apiKey}`);
        HEFENG_API_KEY = apiKey;
    }
}

const devModeArg = process.argv.includes('--dev');
if (devModeArg) {
    console.log('启用免费订阅');
    IS_DEV_MODE = true;
}

// Define Zod schemas for validation
const WeatherArgumentsSchema = z.object({
    location: z.string(), // Location name or coordinates
    days: z.enum(['now', '24h', '72h', '168h', '3d', '7d', '10d', '15d', '30d']).default('now'), // 预报天数
});

// Create server instance
const server = new Server(
    {
        name: "weather-zhcn",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get-weather",
                description: "获取中国国内的天气预报",
                inputSchema: {
                    type: "object",
                    properties: {
                        location: {
                            type: "string",
                            description: "逗号分隔的经纬度信息 (e.g., 116.40,39.90)",
                        },
                        days: {
                            type: "string",
                            enum: ["now", "24h", "72h", "168h", "3d", "7d", "10d", "15d", "30d"],
                            description: "预报天数，now为实时天气，24h为24小时预报，72h为72小时预报，168h为168小时预报，3d为3天预报，以此类推",
                            default: "now"
                        }
                    },
                    required: ["location"],
                },
            },
        ],
    };
});

// Helper function for making HeFeng API requests
async function makeHeFengRequest<T>(url: string): Promise<T | null> {
    const headers = {
        Accept: "application/json",
    };

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return (await response.json()) as T;
    } catch (error) {
        console.error("Error making HeFeng request:", error);
        return null;
    }
}

interface HeFengWeatherNowResponse {
    now: {
        obsTime: string;
        temp: string;
        feelsLike: string;
        text: string;
        windDir: string;
        windScale: string;
    };
}

interface HeFengWeatherDailyResponse {
    daily: Array<{
        fxDate: string;
        tempMax: string;
        tempMin: string;
        textDay: string;
        textNight: string;
        windDirDay: string;
        windScaleDay: string;
        windDirNight: string;
        windScaleNight: string;
    }>;
}

interface HeFengWeatherHourlyResponse {
    hourly: Array<{
        fxTime: string;
        temp: string;
        text: string;
        windDir: string;
        windScale: string;
        humidity: string;
    }>;
}

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const baseUrl = IS_DEV_MODE ? HEFENG_DEV_API_BASE : HEFENG_API_BASE;

    try {
        if (name === "get-weather") {
            const { location, days } = WeatherArgumentsSchema.parse(args);

            if (days === 'now') {
                // Get current weather data
                const weatherUrl = `${baseUrl}/weather/now?location=${location}&key=${HEFENG_API_KEY}`;
                const weatherData = await makeHeFengRequest<HeFengWeatherNowResponse>(weatherUrl);

                if (!weatherData || !weatherData.now) {
                    return {
                        content: [{ type: "text", text: `无法获取 ${location} 的天气数据` }],
                    };
                }

                const { now } = weatherData;
                const weatherText = `地点: ${location}\n` +
                    `观测时间: ${now.obsTime}\n` +
                    `天气: ${now.text}\n` +
                    `温度: ${now.temp}°C\n` +
                    `体感温度: ${now.feelsLike}°C\n` +
                    `风向: ${now.windDir}\n` +
                    `风力: ${now.windScale}级`;

                return { content: [{ type: "text", text: weatherText }] };
            } else if (['24h', '72h', '168h'].includes(days)) {
                // Get hourly forecast data
                const weatherUrl = `${baseUrl}/weather/${days}?location=${location}&key=${HEFENG_API_KEY}`;
                const weatherData = await makeHeFengRequest<HeFengWeatherHourlyResponse>(weatherUrl);

                if (!weatherData || !weatherData.hourly) {
                    return {
                        content: [{ type: "text", text: `无法获取 ${location} 的逐小时天气预报数据` }],
                    };
                }

                const hoursText = weatherData.hourly.map(hour => {
                    return `时间: ${hour.fxTime}\n` +
                        `天气: ${hour.text}\n` +
                        `温度: ${hour.temp}°C\n` +
                        `湿度: ${hour.humidity}%\n` +
                        `风向: ${hour.windDir} ${hour.windScale}级\n` +
                        `------------------------`;
                }).join('\n');

                return {
                    content: [{
                        type: "text",
                        text: `地点: ${location}\n${days}小时预报:\n${hoursText}`
                    }],
                };
            } else {
                // Get daily forecast weather data
                const daysNum = parseInt(days);
                const weatherUrl = `${baseUrl}/weather/${days}?location=${location}&key=${HEFENG_API_KEY}`;
                const weatherData = await makeHeFengRequest<HeFengWeatherDailyResponse>(weatherUrl);

                if (!weatherData || !weatherData.daily) {
                    return {
                        content: [{ type: "text", text: `无法获取 ${location} 的天气预报数据` }],
                    };
                }

                const forecastText = weatherData.daily.map(day => {
                    return `日期: ${day.fxDate}\n` +
                        `白天天气: ${day.textDay}\n` +
                        `夜间天气: ${day.textNight}\n` +
                        `最高温度: ${day.tempMax}°C\n` +
                        `最低温度: ${day.tempMin}°C\n` +
                        `白天风向: ${day.windDirDay} ${day.windScaleDay}级\n` +
                        `夜间风向: ${day.windDirNight} ${day.windScaleNight}级\n` +
                        `------------------------`;
                }).join('\n');

                return {
                    content: [{
                        type: "text",
                        text: `地点: ${location}\n${daysNum}天预报:\n${forecastText}`
                    }],
                };
            }
        } else {
            throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(
                `Invalid arguments: ${error.errors
                    .map((e) => `${e.path.join(".")}: ${e.message}`)
                    .join(", ")}`
            );
        }
        throw error;
    }
});

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Weather-zhcn MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});

