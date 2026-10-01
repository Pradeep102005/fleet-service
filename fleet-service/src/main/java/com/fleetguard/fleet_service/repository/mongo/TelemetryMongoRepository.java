package com.fleetguard.fleet_service.repository.mongo;

import com.fleetguard.fleet_service.entity.mongo.TelemetryDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TelemetryMongoRepository extends MongoRepository<TelemetryDocument, String> {
    List<TelemetryDocument> findTop50ByVinOrderByTimestampDesc(String vin);
    List<TelemetryDocument> findTop20ByEventOrderByTimestampDesc(String event);
}
