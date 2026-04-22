# Design Document: Messaging Template Customization System

## Overview

The Messaging Template Customization System introduces a comprehensive two-tier template management architecture that enables SmartSapp CRM to maintain global default message templates while allowing individual organizations to customize templates for their specific branding and communication needs. This system categorizes all messaging touchpoints across the application and provides a unified interface for template selection, customization, and variable management.

### Design Goals

1. **Two-Tier Architecture**: Implement global templates (super admin managed) with organization-level overrides
2. **Template Categorization**: Organize templates into 7 primary categories with specific template types
3. **Dynamic Variable System**: Support context-aware variable resolution with dynamic schema harvesting
4. **Seamless Integration**: Integrate with existing message composer and automation engine
5. **Reminder Scheduling**: Support time-based reminder templates with automated scheduling
6. **Performance Optimization**: Implement caching and query optimization for template rendering
7. **Migration Strategy**: Provide backward compatibility with existing messaging system

### Key Design Principles

- **Separation of Concerns**: Global templates vs organization customizations
- **Context-Aware**: Templates filtered by category and context
- **Variable Registry**: Centralized variable management with dynamic schema
- **Audit Trail**: Complete logging of template usage and modifications
- **Scalability**: Efficient querying and caching for high-volume messaging

---

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Presentation Layer"
        MC[Message Composer]
        BO[Back Office UI]
        OT[Org Template Manager]
    end
    
    subgraph "Application Layer"
        TA[Template Actions]
        VA[Variable Actions]
        ME[Messaging Engine]
        RS[Reminder Scheduler]
    end
    
    subgraph "Data Layer"
        GT[(Global Templates)]
        ORT[(Org Templates)]
        VR[(Variable Registry)]
        ML[(Message Logs)]
    end
    
    subgraph "External Systems"
        FS[Firestore]
        AE[Automation Engine]
        SP[SMS/Email Providers]
    end
    
    MC --> TA
    BO --> TA
    OT --> TA
    TA --> GT
    TA --> ORT
    TA --> VR
    ME --> TA
    ME --> VA
    RS --> TA
    AE --> ME
    ME --> SP
    ME --> ML
    
    GT --> FS
    ORT --> FS
    VR --> FS
    ML --> FS
