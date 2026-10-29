import { InMemoryStationRouteRepository } from "#adapters/memory/in-memory-station-route-repository.js";
import { stationRouteRepositoryContract } from "#application/ports/station-route-repository.contract.js";

stationRouteRepositoryContract(() => new InMemoryStationRouteRepository());
