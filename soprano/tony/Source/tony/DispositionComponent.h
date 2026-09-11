// Frontline — ported from soprano/rig-demo.html's relationshipPose()/readout().
// Same two inputs, same four-quadrant read. The browser demo proved the
// technique against a drawn capsule figure; this is the same data feeding
// a real skeleton instead. See the .cpp for the mapping to Animation
// Blueprint variables.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "DispositionComponent.generated.h"

/**
 * Carried by an NPC. Loyalty and Fear are the only inputs — everything an
 * Animation Blueprint or a dialogue system needs (posture lean, a plain-
 * language read) is derived from just those two, the same way the sim's
 * own perceive() fog never exposes more than a stat needs to answer one
 * question at a time.
 */
UCLASS(ClassGroup=(Frontline), meta=(BlueprintSpawnableComponent))
class UDispositionComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UDispositionComponent();

	/** 0-100. High: takes the assignment without being asked twice. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Disposition", meta=(ClampMin="0", ClampMax="100"))
	float Loyalty = 70.f;

	/** 0-100. High: obeys, and hates that the room can see it. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Disposition", meta=(ClampMin="0", ClampMax="100"))
	float Fear = 25.f;

	/**
	 * 0-1. How much the body pulls inward — feeds an Animation Blueprint's
	 * lean/tension blend the same way relationshipPose() in the browser
	 * demo turned these two numbers into shoulder and elbow angles. Call
	 * this from the AnimBP's Blueprint thread (a "Get Tension" node) and
	 * plug it into a Layered Blend Per Bone or a spine Transform (Modify)
	 * Bone alongside the default locomotion — do not replace the base
	 * animation with it, add to it, the same way the demo added a lean
	 * offset on top of an idle sway rather than switching poses outright.
	 */
	UFUNCTION(BlueprintPure, Category="Disposition")
	float GetTension() const;

	/** Degrees. Positive tilts the chest inward/down. Small on purpose —
	 *  see the demo's own note that this reads at a distance, not in a
	 *  close-up; this is not the number to use for a dialogue camera. */
	UFUNCTION(BlueprintPure, Category="Disposition")
	float GetPostureLean() const;

	/** Short tag: STEADY / SHAKEN / COMPLIANT / DRIFTING / READING. For a
	 *  UI label or a debug readout — not for the player to see raw. */
	UFUNCTION(BlueprintPure, Category="Disposition")
	FString GetReadoutTag() const;

	/** The one line a memo or a dossier entry would actually print. */
	UFUNCTION(BlueprintPure, Category="Disposition")
	FString GetReadoutLine() const;
};
