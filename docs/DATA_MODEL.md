# Data Model

## Overview

This document describes the data model for the Ancestry Family Tree application.

## Core Entities

### Person
Represents an individual in the family tree.

**Key Attributes:**
- Unique identifier
- Claims about the person (name, birth, death, etc.)
- Relationships to other people
- Tenant/organization association

### Relationship
Represents connections between people.

**Types:**
- Parent-child
- Spouse
- Sibling (derived or explicit)

**Key Attributes:**
- Source and target person references
- Relationship type
- Time period (if applicable)
- Supporting evidence

### Event
Life events associated with people.

**Types:**
- Birth, Death, Marriage, Baptism, Census, etc.

**Key Attributes:**
- Event type
- Date (with uncertainty support)
- Place reference
- Participants
- Sources

### Claim
A statement about a fact, supported by evidence.

**Key Attributes:**
- Subject (what the claim is about)
- Property (what aspect is being claimed)
- Value (the claimed information)
- Confidence level
- Sources/evidence
- Conflicts with other claims

### Source
References to external information.

**Types:**
- Document
- Book
- Website
- Oral history
- Certificate

**Key Attributes:**
- Citation (structured)
- Repository information
- Author/creator
- Date
- Media attachments

### Media
Digital assets supporting research.

**Types:**
- Images, Documents, Audio, Video

**Key Attributes:**
- File reference/URL
- Type
- Associated sources
- Transcriptions
- Metadata (EXIF, etc.)

### Place
Geographic locations with historical awareness.

**Key Attributes:**
- Name (with variants and historical names)
- Geographic coordinates
- Parent place (hierarchy)
- Time period of existence
- Type (city, county, country, etc.)

## Relationships Between Entities

```
Person
  ├─ has many Claims
  ├─ participates in Events
  ├─ has Relationships (to other People)
  └─ belongs to Organization (tenant)

Event
  ├─ has many Claims
  ├─ occurs at Place
  └─ references Sources

Claim
  ├─ references Sources
  └─ may conflict with other Claims

Source
  ├─ has Media attachments
  └─ supports Claims

Place
  └─ has historical hierarchy
```

## Multi-Tenancy

- Most entities are scoped to an organization/tenant
- Some data (e.g., standardized places) may be shared globally
- Access control enforced at query level

## Handling Uncertainty

### Dates
- Support for approximate dates (circa, before, after)
- Date ranges
- Partial dates (e.g., "1850" without day/month)

### Conflicting Information
- Multiple claims can exist for the same fact
- Each claim linked to sources
- Users can indicate preferred/accepted claims
- System preserves all evidence

## Search & Retrieval (RAG Strategy)

- Full-text search on names, places, events
- Vector embeddings for semantic search
- Document content indexed via OCR
- Relationship graph traversal

## Future Enhancements

- Collaboration features (shared trees, merge requests)
- DNA integration
- Automated hint generation
- Timeline visualization
