package com.fleetguard.fleet_service.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {

    public static final String RAW_TOPIC = "telemetry.raw";
    public static final String CLEAN_TOPIC = "telemetry.clean";
    public static final String DLQ_TOPIC = "telemetry.dlq";
    public static final String ALERTS_TOPIC = "alerts";

    @Bean
    public NewTopic rawTopic() {
        return TopicBuilder.name(RAW_TOPIC)
                .partitions(6)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic cleanTopic() {
        return TopicBuilder.name(CLEAN_TOPIC)
                .partitions(6)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic dlqTopic() {
        return TopicBuilder.name(DLQ_TOPIC)
                .partitions(6)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic alertsTopic() {
        return TopicBuilder.name(ALERTS_TOPIC)
                .partitions(6)
                .replicas(1)
                .build();
    }
}
