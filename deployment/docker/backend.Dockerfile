FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy solution and project files
COPY ["backend/WebApp.sln", "./"]
COPY ["backend/WebApp.Api/WebApp.Api.csproj", "backend/WebApp.Api/"]
COPY ["backend/WebApp.ServiceDefaults/WebApp.ServiceDefaults.csproj", "backend/WebApp.ServiceDefaults/"]

# Restore dependencies
RUN dotnet restore "backend/WebApp.Api/WebApp.Api.csproj"

# Copy source code
COPY . .

# Build project
WORKDIR "/src/backend/WebApp.Api"
RUN dotnet build "WebApp.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "WebApp.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "WebApp.Api.dll"]
