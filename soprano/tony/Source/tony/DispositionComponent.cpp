#include "DispositionComponent.h"

UDispositionComponent::UDispositionComponent()
{
	// Pure data + derived reads, nothing to tick.
	PrimaryComponentTick.bCanEverTick = false;
}

float UDispositionComponent::GetTension() const
{
	// Same clamp01(fear/100) the demo called `dread`. Loyalty doesn't
	// shrink the visible tension here — a loyal-but-scared man still
	// tenses up, per the same SHAKEN case the readout below names.
	return FMath::Clamp(Fear / 100.f, 0.f, 1.f);
}

float UDispositionComponent::GetPostureLean() const
{
	const float Confidence = FMath::Clamp(Loyalty / 100.f, 0.f, 1.f);
	const float Dread = GetTension();
	// lerp(1, -6, confidence) - dread * 5 — identical to relationshipPose()
	// in rig-demo.html. Upright and confident leans slightly back (-6);
	// low loyalty leans forward a touch (1); fear pulls it forward further.
	return FMath::Lerp(1.f, -6.f, Confidence) - Dread * 5.f;
}

FString UDispositionComponent::GetReadoutTag() const
{
	const bool L = Loyalty >= 60.f, l = Loyalty < 35.f;
	const bool F = Fear >= 60.f, f = Fear < 35.f;
	if (L && f) return TEXT("STEADY");
	if (L && F) return TEXT("SHAKEN");
	if (l && F) return TEXT("COMPLIANT");
	if (l && f) return TEXT("DRIFTING");
	return TEXT("READING");
}

FString UDispositionComponent::GetReadoutLine() const
{
	const bool L = Loyalty >= 60.f, l = Loyalty < 35.f;
	const bool F = Fear >= 60.f, f = Fear < 35.f;
	if (L && f) return TEXT("Stands square. Takes the assignment without being asked twice.");
	if (L && F) return TEXT("Loyal, but rattled — obeys, and hates that the room can see it.");
	if (l && F) return TEXT("Obeys because he has to. Already rehearsing what he'd say if it ever came apart.");
	if (l && f) return TEXT("Nothing holding him here but habit. Watching the door more than the boss.");
	return TEXT("Somewhere in the middle — the room hasn't decided what he is yet.");
}
