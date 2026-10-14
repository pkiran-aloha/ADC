FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

COPY src/Welina.Analytics.Api/*.csproj ./src/Welina.Analytics.Api/
RUN dotnet restore src/Welina.Analytics.Api/Welina.Analytics.Api.csproj

COPY src/ ./src/
WORKDIR /app/src/Welina.Analytics.Api
RUN dotnet publish -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /out ./
EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000
ENTRYPOINT ["dotnet", "Welina.Analytics.Api.dll"]
