# Learning Module Images

This directory contains images that enhance the learning experience in the AI Tutor.

## Directory Structure

```
images/
├── fractions/          # Fractions learning images
├── algebra/            # Algebra learning images  
├── geometry/           # Geometry learning images
├── ratio/              # Ratio learning images
├── speed/              # Speed learning images
└── common/             # Shared images across topics
```

## Naming Convention

Images are automatically displayed if they match the exact section ID from the JSON files:

**Format**: `{section_id}.{png|jpg}`

**Examples**:
- `p6_math_fractions_step1_001.png`
- `p6_math_algebra_step2_005.jpg`
- `p6_math_geometry_step1_003.png`

## Image Guidelines

### Technical Requirements
- **Formats**: PNG or JPG only
- **Mobile-first**: Optimized for small screens (320px+ width)
- **Max width**: 400px recommended for readability
- **File size**: Keep under 100KB for fast loading
- **Resolution**: 72-96 DPI sufficient for web

### Content Guidelines
- **Clear and simple**: Avoid cluttered diagrams
- **High contrast**: Ensure readability on all devices
- **Educational focus**: Support the learning objective
- **Consistent style**: Maintain visual coherence within topics

## Usage

Images are automatically loaded based on section IDs. No code changes needed:

1. Create image with correct filename
2. Place in appropriate topic folder  
3. Image appears below text in chat automatically
4. Missing images are gracefully ignored

## Examples

### Fractions
- Pizza slice diagrams
- Fraction bars/strips
- Number line representations
- Visual division examples

### Algebra  
- Variable representations
- Equation balancing visuals
- Graph illustrations

### Geometry
- Shape diagrams
- Angle measurements
- Area/perimeter visuals