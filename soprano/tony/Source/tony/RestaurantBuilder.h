// Procedural restaurant, built the way WBArena.cpp builds its arena: engine
// primitives (/Engine/BasicShapes/Cube.Cube etc.) tinted through
// BasicShapeMaterial's Color parameter, no authored meshes or materials.
// Zero Editor placement — GameMode spawns one of these in BeginPlay.
//
// Layout is real restaurant spatial logic, not a guess: guest circulation
// (entrance -> dining/bar, open plan, no wall between them since a bar is
// a room feature, not a room) stays entirely separate from back-of-house
// circulation (kitchen/storage/hallway/private room), which only meets
// the guest side at two deliberate doorways — one service door by the
// kitchen, one hallway entrance by the private room. That split, guest
// path vs. staff path meeting only where the plan wants them to, is the
// one piece of real-world restaurant design this scene has to get right
// for "the meeting happens in the back room" to make any spatial sense
// later.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "RestaurantBuilder.generated.h"

class UStaticMeshComponent;
class UTextRenderComponent;

UCLASS()
class ARestaurantBuilder : public AActor
{
	GENERATED_BODY()

public:
	ARestaurantBuilder();

	virtual void BeginPlay() override;

	/** Just outside the front door, facing in — where the player (or an
	 *  NPC entering the scene) should start. */
	FVector GetEntranceLocation() const { return EntranceLocation; }

protected:
	UPROPERTY(VisibleAnywhere)
	TObjectPtr<USceneComponent> SceneRoot;

private:
	void Build();

	// One piece of blockout geometry: an engine cube, scaled, tinted.
	UStaticMeshComponent* Slab(const FVector& Center, const FVector& Size, int32 ColorIndex, bool bCollide = true);
	UStaticMeshComponent* Column(const FVector& Center, float Radius, float Height, int32 ColorIndex);
	void Label(const FVector& Center, const FString& Text);

	// A wall on the X=Const or Y=Const plane, running along one axis,
	// with an optional doorway gap. Rooms are defined by floor footprints
	// alone; walls are specified explicitly per boundary that needs one —
	// there are few enough (nine) that a generic room-graph wall solver
	// would be solving a harder problem than this floor plan has.
	void WallAlongX(float ConstY, float X0, float X1, float Height, int32 ColorIndex,
		float GapStart = 0.f, float GapEnd = 0.f);
	void WallAlongY(float ConstX, float Y0, float Y1, float Height, int32 ColorIndex,
		float GapStart = 0.f, float GapEnd = 0.f);

	FVector EntranceLocation = FVector::ZeroVector;

	int32 PieceCount = 0;
};
