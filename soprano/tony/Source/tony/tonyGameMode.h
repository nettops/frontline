// Copyright Epic Games, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "tonyGameMode.generated.h"

class ARestaurantBuilder;

/**
 *  Simple Game Mode for a top-down perspective game
 *  Sets the default gameplay framework classes
 *  Check the Blueprint derived class for the set values
 */
UCLASS(abstract)
class AtonyGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:

	/** Constructor */
	AtonyGameMode();

	virtual void BeginPlay() override;

	/** Spawned in BeginPlay, not placed in the level — see
	 *  RestaurantBuilder.h for why. Null until BeginPlay has run, which
	 *  is guaranteed before any pawn spawns (GameMode BeginPlay runs
	 *  first), so a Character reading this in its own BeginPlay is safe. */
	ARestaurantBuilder* GetRestaurant() const { return Restaurant; }

private:
	UPROPERTY()
	TObjectPtr<ARestaurantBuilder> Restaurant;
};



