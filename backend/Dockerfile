# Build with the repository root as context: docker build -f backend/Dockerfile .
# Both frontend and API use data/clinicalSeed.json; the API embeds it at publish time.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

COPY backend/src/Welina.Analytics.Api/*.csproj ./backend/src/Welina.Analytics.Api/
COPY data/clinicalSeed.json ./data/clinicalSeed.json
RUN dotnet restore backend/src/Welina.Analytics.Api/Welina.Analytics.Api.csproj

COPY backend/src/ ./backend/src/
WORKDIR /app/backend/src/Welina.Analytics.Api
RUN dotnet publish -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /out ./
EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000
ENTRYPOINT ["dotnet", "Welina.Analytics.Api.dll"]
